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
    const target = body?.target as string | undefined;
    const codeRaw = body?.code as string | undefined;

    if (!walletAddress || !target || !codeRaw) {
      return NextResponse.json(
        { error: "Missing walletAddress/target/code" },
        { status: 400 },
      );
    }
    const code = codeRaw.trim().toUpperCase();

    const room = await getRoom(code);
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (!isLeader(room, walletAddress)) {
      return NextResponse.json(
        { error: "Only the leader can kick players" },
        { status: 403 },
      );
    }
    if (target.toLowerCase() === walletAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "The leader cannot kick themselves" },
        { status: 400 },
      );
    }

    const victim = findPlayer(room, target);
    if (!victim)
      return NextResponse.json(
        { error: "Player is not in the room" },
        { status: 404 },
      );

    const hadStakes =
      room.paid &&
      !!room.roundId &&
      (await roundHasOnChainStakes(room.roundId, room.players));

    // If kicking a staked player OR any staked player exists → cancel whole room + refund
    if (hadStakes) {
      let refundTx: string | null = null;
      if (room.roundId) {
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

    room.players = room.players.filter(
      (p) => p.address.toLowerCase() !== target.toLowerCase(),
    );
    await saveRoom(room);
    await unbindPlayer(target);

    return NextResponse.json({ ok: true, room });
  } catch (err: any) {
    console.error("rooms/kick error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
