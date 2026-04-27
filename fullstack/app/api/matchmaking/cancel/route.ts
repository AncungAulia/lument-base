import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";
import {
  backendRefund,
  isRoundRefunded,
  roundHasOnChainStakes,
} from "@/lib/sc/refund";

const LOCK_TTL = 10; // seconds — prevents concurrent / double cancel for same player

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

    // Per-player atomic lock — prevents race condition between concurrent
    // join + leave calls or repeated "go back" clicks.
    const lockKey = `cancel-lock:${walletAddress}`;
    const lockAcquired = await redis.set(lockKey, "1", { nx: true, ex: LOCK_TTL });
    if (!lockAcquired) {
      return NextResponse.json({
        success: true,
        playerState: "left_queue",
        message: "Cancel already in progress",
        queueState: { removed: false },
      });
    }

    try {
      const queueKey = normalizedRoom
        ? `queue:room:${normalizedRoom}`
        : `queue:mode:${mode}`;
      const playerKey = `queue:player:${walletAddress}`;

      // Atomic removal from queue set + heartbeat deletion
      const [removedCount] = await Promise.all([
        redis.srem(queueKey, walletAddress),
        redis.del(playerKey),
      ]);

      // Read match data before deleting — needed for on-chain refund check.
      const matchRaw = await redis.get(`match:${walletAddress}`);
      const match = parseRedisJson<{ roundId: string; players: string[] }>(
        matchRaw as string | null,
      );
      await redis.del(`match:${walletAddress}`);

      // If player was already matched and may have staked, check on-chain and refund.
      let refundTx: string | null = null;
      if (match?.roundId && match.players?.length) {
        const playerObjs = match.players.map((address) => ({ address }));
        try {
          const hasStakes = await roundHasOnChainStakes(
            match.roundId,
            playerObjs,
          );
          if (hasStakes) {
            const already = await isRoundRefunded(match.roundId);
            if (!already) {
              const result = await backendRefund(match.roundId);
              refundTx = result.txHash;
            }
          }
        } catch (e) {
          console.error("matchmaking cancel refund failed:", e);
        }
      }

      const removed = removedCount > 0;
      return NextResponse.json({
        success: true,
        playerState: "left_queue",
        message: removed
          ? "Successfully left the queue"
          : "Player was not in the queue (already cleaned up)",
        queueState: { removed },
        refundTx,
      });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error: unknown) {
    const e = error as Error;
    console.error("Matchmaking Cancel Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
