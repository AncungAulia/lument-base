import { NextResponse } from "next/server";
import {
  getRoom,
  saveRoom,
  deleteRoom,
  unbindPlayer,
  findPlayer,
  isLeader,
} from "@/lib/rooms";
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
    if (!room) {
      await unbindPlayer(walletAddress);
      return NextResponse.json({ ok: true });
    }

    const player = findPlayer(room, walletAddress);
    if (!player) {
      await unbindPlayer(walletAddress);
      return NextResponse.json({ ok: true });
    }

    const hadStakes =
      room.paid &&
      !!room.roundId &&
      (await roundHasOnChainStakes(room.roundId, room.players));
    const leaderLeaving = isLeader(room, walletAddress);

    // If leader leaves OR any player has staked → cancel whole room + batch refund
    if (leaderLeaving || hadStakes) {
      let refundTx: string | null = null;
      if (hadStakes && room.roundId) {
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

      room.status = "cancelled";
      await deleteRoom(room);

      try {
        await supabaseAdmin
          .from("rooms")
          .update({
            status: "cancelled",
            resolved_at: new Date().toISOString(),
          })
          .eq("code", room.code);
      } catch (e) {
        console.warn("rooms update failed:", e);
      }

      return NextResponse.json({ ok: true, cancelled: true, refundTx });
    }

    // Non-leader, unstaked → just drop from roster
    room.players = room.players.filter(
      (p) => p.address.toLowerCase() !== walletAddress.toLowerCase(),
    );
    await saveRoom(room);
    await unbindPlayer(walletAddress);

    return NextResponse.json({ ok: true, room });
  } catch (err: any) {
    console.error("rooms/leave error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
