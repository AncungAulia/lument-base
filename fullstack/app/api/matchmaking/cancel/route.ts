import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";
import {
  backendRefund,
  isRoundRefunded,
  roundHasOnChainStakes,
} from "@/lib/sc/refund";

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

    const queueKey = normalizedRoom
      ? `queue:room:${normalizedRoom}`
      : `queue:mode:${mode}`;
    const playerKey = `queue:player:${walletAddress}`;

    // Remove from queue set
    const removedCount = await redis.srem(queueKey, walletAddress);

    // Remove player heartbeat key
    await redis.del(playerKey);

    // Read match data before deleting — needed for on-chain refund check.
    const matchRaw = await redis.get(`match:${walletAddress}`);
    const match = parseRedisJson<{ roundId: string; players: string[] }>(
      matchRaw as string | null,
    );
    await redis.del(`match:${walletAddress}`);

    // If this player was already matched and may have staked, check on-chain and refund.
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
        console.error("matchmaking refund failed:", e);
      }
    }

    if (removedCount > 0) {
      return NextResponse.json({
        success: true,
        message: "Successfully left the queue",
        refundTx,
      });
    } else {
      return NextResponse.json({
        success: true,
        message: "Player was not in the queue (already cleaned up)",
        refundTx,
      });
    }
  } catch (error: any) {
    console.error("Matchmaking Cancel Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
