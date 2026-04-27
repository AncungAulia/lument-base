import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";
import { tryMatch, QUEUE_TTL } from "../join/route";

function getRequiredPlayers(mode: number) {
  if (mode === 1) return 2;
  if (mode === 2) return 5;
  return 1;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const modeStr = searchParams.get("mode");
    const mode = modeStr !== null ? Number(modeStr) : null;
    const roomCodeParam = searchParams.get("roomCode");
    const roomCode = roomCodeParam ? roomCodeParam.trim().toUpperCase() : null;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 },
      );
    }

    // Heartbeat: refresh TTL to prove player is still alive.
    // If key expired (tab throttling / slow network) but player is polling, re-register them
    // so they aren't silently evicted from the queue.
    const playerKey = `queue:player:${walletAddress}`;
    const playerDataStr = (await redis.get(playerKey)) as string | null;

    if (playerDataStr) {
      await redis.expire(playerKey, QUEUE_TTL);
    } else if (mode !== null) {
      // Key expired but player is actively polling — put them back
      const queueKey = roomCode
        ? `queue:room:${roomCode}`
        : `queue:mode:${mode}`;
      const stillInQueue = await redis.sismember(queueKey, walletAddress);
      if (stillInQueue) {
        await redis.set(
          playerKey,
          JSON.stringify({
            walletAddress,
            mode,
            roomCode,
            joinedAt: Date.now(),
            reregistered: true,
          }),
          { ex: QUEUE_TTL },
        );
      }
    }

    // Check if already matched
    const matchData = parseRedisJson<object>(
      await redis.get(`match:${walletAddress}`),
    );
    if (matchData) {
      return NextResponse.json({ matched: true, ...matchData });
    }

    // Count alive players and attempt match when enough are present
    let queueCount = 0;
    if (mode !== null) {
      const queueKey = roomCode
        ? `queue:room:${roomCode}`
        : `queue:mode:${mode}`;
      const required = getRequiredPlayers(mode);
      const playersInQueue = await redis.smembers(queueKey);

      for (const p of playersInQueue) {
        const alive = await redis.exists(`queue:player:${p}`);
        if (alive) queueCount++;
        else await redis.srem(queueKey, p);
      }

      if (queueCount >= required) {
        const result = await tryMatch(queueKey, required, mode);
        if (result.matched) {
          return NextResponse.json(result);
        }
        queueCount = result.queueCount;
      }
    }

    return NextResponse.json({ matched: false, queueCount });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("Matchmaking Status Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
