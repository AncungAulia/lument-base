import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";
import {
  backendRefund,
  isRoundRefunded,
  roundHasOnChainStakes,
} from "@/lib/sc/refund";

const CANCELLED_TTL = 3600; // 1 hour — long enough for opponent's next poll
const LOCK_TTL = 10; // seconds — prevents double-leave for same player

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, roundId } = body;

    if (!walletAddress || !roundId) {
      return NextResponse.json(
        { error: "Missing walletAddress or roundId" },
        { status: 400 },
      );
    }

    // Per-player idempotency lock — prevents double-leave / repeated clicks
    const lockKey = `leave-matched-lock:${walletAddress}`;
    const lockAcquired = await redis.set(lockKey, "1", { nx: true, ex: LOCK_TTL });
    if (!lockAcquired) {
      return NextResponse.json({
        success: true,
        playerState: "left_after_stake",
        message: "Leave already in progress",
      });
    }

    try {
      // Read match data to discover all players in the round
      const matchRaw = await redis.get(`match:${walletAddress}`);
      const match = parseRedisJson<{ roundId: string; players: string[] }>(
        matchRaw as string | null,
      );

      // Already cleaned up (e.g. concurrent match start fired first)
      if (!match?.roundId) {
        // Check if the round was already cancelled by the other side
        const alreadyCancelled = await redis.get(`round:${roundId}:cancelled`);
        if (alreadyCancelled) {
          return NextResponse.json({
            success: true,
            playerState: "left_after_stake",
            message: "Match already cancelled",
          });
        }
        return NextResponse.json({
          success: true,
          playerState: "left_after_stake",
          message: "Match data already cleaned up",
        });
      }

      const allPlayers = match.players?.length ? match.players : [walletAddress];
      const playerObjs = allPlayers.map((addr) => ({ address: addr }));

      // Check and execute on-chain refund
      let refundTx: string | null = null;
      try {
        const hasStakes = await roundHasOnChainStakes(match.roundId, playerObjs);
        if (hasStakes) {
          const already = await isRoundRefunded(match.roundId);
          if (!already) {
            const result = await backendRefund(match.roundId);
            refundTx = result.txHash;
          }
        }
      } catch (e) {
        console.error("leave-matched refund failed:", e);
        // TODO: Enqueue for retry — partial refund failure is logged but must not
        // block state cleanup; opponents still need to know the match is cancelled.
      }

      // Broadcast cancellation so opponents detect it via matched-status polling.
      // Stored at round level — survives the individual player's match key deletion.
      const cancelPayload = JSON.stringify({
        reason: "player_left_after_stake",
        leftBy: walletAddress,
        refundTx,
        ts: Date.now(),
      });
      await redis.set(`round:${match.roundId}:cancelled`, cancelPayload, {
        ex: CANCELLED_TTL,
      });

      // Atomically delete all per-player match keys for this round
      const pipe = redis.pipeline();
      for (const addr of allPlayers) {
        pipe.del(`match:${addr}`);
      }
      await pipe.exec();

      return NextResponse.json({
        success: true,
        playerState: "left_after_stake",
        refundTx,
      });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error: unknown) {
    const e = error as Error;
    console.error("leave-matched error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
