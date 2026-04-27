import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";
import { supabaseAdmin } from "@/lib/db/supabase";
import { randomBytes } from "crypto";

export const QUEUE_TTL = 60; // seconds — generous window for slow connections / tab throttling

function getRequiredPlayers(mode: number) {
  if (mode === 1) return 2;
  if (mode === 2) return 5;
  return 1;
}

export async function tryMatch(
  queueKey: string,
  requiredPlayers: number,
  mode: number,
): Promise<
  | { matched: true; roundId: string; players: string[] }
  | { matched: false; queueCount: number }
> {
  // Distributed lock prevents two concurrent requests from creating duplicate matches
  const lockKey = `queue:lock:${queueKey}`;
  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 5 });
  if (!acquired) {
    // Another request is already running tryMatch for this queue — report current count
    const members = await redis.smembers(queueKey);
    return { matched: false, queueCount: members.length };
  }

  try {
    const playersInQueue = await redis.smembers(queueKey);
    const alivePlayers: string[] = [];
    for (const p of playersInQueue) {
      const alive = await redis.exists(`queue:player:${p}`);
      if (alive) alivePlayers.push(p);
      else await redis.srem(queueKey, p);
    }

    if (alivePlayers.length < requiredPlayers) {
      return { matched: false, queueCount: alivePlayers.length };
    }

    const matchedPlayers = alivePlayers.slice(0, requiredPlayers);
    const roundId = "0x" + randomBytes(32).toString("hex");

    const pipeline = redis.pipeline();
    matchedPlayers.forEach((p) => {
      pipeline.srem(queueKey, p);
      pipeline.del(`queue:player:${p}`);
      pipeline.set(
        `match:${p}`,
        JSON.stringify({ roundId, players: matchedPlayers }),
        { ex: 3600 },
      );
    });
    pipeline.set(`round:${roundId}:players`, JSON.stringify(matchedPlayers), {
      ex: 3600,
    });
    pipeline.set(
      `round:${roundId}:meta`,
      JSON.stringify({
        casual: false,
        stakeAmount: 10,
        mode,
        source: "public",
      }),
      { ex: 3600 },
    );
    await pipeline.exec();

    // Supabase analytics — non-fatal
    try {
      const playersData = matchedPlayers.map((a) => ({
        wallet_address: a.toLowerCase(),
      }));
      await supabaseAdmin
        .from("players")
        .upsert(playersData, { onConflict: "wallet_address" });

      const { data: round } = await supabaseAdmin
        .from("rounds")
        .insert({
          game_round_id: roundId.toLowerCase(),
          mode,
          source: "public",
          status: "matched",
        })
        .select("id")
        .single();

      if (round) {
        await supabaseAdmin
          .from("round_participants")
          .insert(
            matchedPlayers.map((a) => ({
              round_id: round.id,
              wallet_address: a.toLowerCase(),
            })),
          );
      }
    } catch (e) {
      console.warn("Supabase record failed (non-fatal):", e);
    }

    return { matched: true, roundId, players: matchedPlayers };
  } finally {
    await redis.del(lockKey);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, mode, roomCode } = body;

    if (!walletAddress || typeof mode !== "number") {
      return NextResponse.json(
        { error: "Missing walletAddress or mode" },
        { status: 400 },
      );
    }

    const normalizedRoom =
      typeof roomCode === "string" && roomCode.trim()
        ? roomCode.trim().toUpperCase()
        : null;

    // Clean up ALL stale state from previous sessions — including any leftover match key.
    // The match key has a 1-hour TTL and was previously only deleted by the cancel route.
    // If a player skipped cancel (page close, direct navigation back), that stale key would
    // make every subsequent join immediately return the old roundId (ghost round).
    await Promise.all([
      redis.del(`match:${walletAddress}`),
      redis.del(`queue:player:${walletAddress}`),
      redis.srem("queue:mode:0", walletAddress),
      redis.srem("queue:mode:1", walletAddress),
      redis.srem("queue:mode:2", walletAddress),
    ]);

    const queueKey = normalizedRoom
      ? `queue:room:${normalizedRoom}`
      : `queue:mode:${mode}`;
    const requiredPlayers = getRequiredPlayers(mode);

    await redis.sadd(queueKey, walletAddress);
    await redis.set(
      `queue:player:${walletAddress}`,
      JSON.stringify({
        walletAddress,
        mode,
        roomCode: normalizedRoom,
        joinedAt: Date.now(),
      }),
      { ex: QUEUE_TTL },
    );

    const result = await tryMatch(queueKey, requiredPlayers, mode);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const e = error as Error;
    console.error("Matchmaking Join Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
