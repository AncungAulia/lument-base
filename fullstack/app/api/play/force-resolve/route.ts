import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";
import {
  deltaE,
  accuracyFromDeltaE,
  tier,
  targetFromRoundId,
  type TargetDifficulty,
} from "@/src/utils/color";
import { resolveMultiplayer } from "../submit/route";

const DEFAULT_GUESS = { h: 180, s: 50, l: 50 };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roundId } = body;

    if (!roundId) {
      return NextResponse.json({ error: "Missing roundId" }, { status: 400 });
    }

    // If already resolved, return result immediately
    const existing = parseRedisJson<object>(
      await redis.get(`round:${roundId}:result`),
    );
    if (existing) {
      return NextResponse.json({ resolved: true, ...existing });
    }

    const players = parseRedisJson<string[]>(
      await redis.get(`round:${roundId}:players`),
    );
    if (!players) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const meta = parseRedisJson<{ difficulty?: TargetDifficulty }>(
      await redis.get(`round:${roundId}:meta`),
    );
    const target = targetFromRoundId(roundId, meta?.difficulty ?? "medium");

    // Auto-submit default guess for any player who hasn't submitted
    for (const p of players) {
      const key = `round:${roundId}:score:${p.toLowerCase()}`;
      const existing = await redis.get(key);
      if (!existing) {
        const dE = deltaE(target, DEFAULT_GUESS);
        const acc = accuracyFromDeltaE(dE);
        const t = tier(acc);
        await redis.set(
          key,
          JSON.stringify({
            address: p.toLowerCase(),
            accuracy: acc,
            tier: t.name,
            score: Math.round(acc * 100),
            timeSec: 15,
            guess: DEFAULT_GUESS,
          }),
          { ex: 3600 },
        );
      }
    }

    // Now all players have scores — resolve
    const scoreResults = await Promise.all(
      players.map((p) =>
        redis.get(`round:${roundId}:score:${p.toLowerCase()}`),
      ),
    );

    const baseResult = { method: "force-resolve" };
    return resolveMultiplayer(
      roundId,
      players,
      scoreResults as (string | null)[],
      players.length,
      baseResult,
    );
  } catch (error: any) {
    console.error("Force-resolve error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
