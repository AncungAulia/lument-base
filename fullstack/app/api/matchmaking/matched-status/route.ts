import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";

// Polled by the opponent (every 2 s) to detect "player_left_staked" events.
// This replaces a WebSocket push in this HTTP-polling architecture.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roundId = searchParams.get("roundId");
    const walletAddress = searchParams.get("walletAddress");

    if (!roundId || !walletAddress) {
      return NextResponse.json(
        { error: "Missing roundId or walletAddress" },
        { status: 400 },
      );
    }

    const cancelledRaw = await redis.get(`round:${roundId}:cancelled`);
    const cancelled = parseRedisJson<{
      reason: string;
      leftBy: string;
      refundTx: string | null;
      ts: number;
    }>(cancelledRaw as string | null);

    if (cancelled) {
      // Omit leftBy when querying from the same player who triggered the leave
      const isRequester =
        cancelled.leftBy.toLowerCase() === walletAddress.toLowerCase();
      return NextResponse.json({
        cancelled: true,
        reason: cancelled.reason,
        leftBy: isRequester ? null : cancelled.leftBy,
        refundTx: cancelled.refundTx,
        playerState: isRequester ? "left_after_stake" : "partner_left",
      });
    }

    return NextResponse.json({ cancelled: false });
  } catch (error: unknown) {
    const e = error as Error;
    console.error("matched-status error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
