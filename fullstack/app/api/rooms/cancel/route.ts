import { NextResponse } from "next/server";
import { getRoom, deleteRoom, isLeader } from "@/lib/rooms";
import {
  backendRefund,
  isRoundRefunded,
  roundHasOnChainStakes,
} from "@/lib/sc/refund";
import { supabaseAdmin } from "@/lib/db/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const walletAddress = body?.walletAddress as string | undefined;
    const codeRaw = body?.code as string | undefined;

    if (!walletAddress || !codeRaw) {
      return NextResponse.json(
        { error: "Missing walletAddress or code" },
        { status: 400 },
      );
    }
    const code = codeRaw.trim().toUpperCase();

    const room = await getRoom(code);
    if (!room) return NextResponse.json({ ok: true });
    if (!isLeader(room, walletAddress)) {
      return NextResponse.json(
        { error: "Only the leader can cancel the room" },
        { status: 403 },
      );
    }

    let refundTx: string | null = null;
    if (
      room.paid &&
      room.roundId &&
      (await roundHasOnChainStakes(room.roundId, room.players))
    ) {
      try {
        const already = await isRoundRefunded(room.roundId);
        if (!already) {
          const { txHash } = await backendRefund(room.roundId);
          refundTx = txHash;
        }
      } catch (e) {
        console.error("refund failed:", e);
      }
    }

    await deleteRoom(room);

    try {
      await supabaseAdmin
        .from("rooms")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("code", room.code);
    } catch (e) {
      console.warn("rooms update failed:", e);
    }

    return NextResponse.json({ ok: true, refundTx });
  } catch (err: any) {
    console.error("rooms/cancel error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
