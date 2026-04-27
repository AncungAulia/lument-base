import { NextResponse } from "next/server";
import { getRoom, saveRoom, findPlayer, generateRoundId, isLeader } from "@/lib/rooms";

// Reset an already-played room back to lobby so the same group can run another round.
// - Generates a fresh roundId (prior one was resolved/refunded on-chain and can't be reused).
// - Clears each player's staked/ready state so paid players must re-stake.
// - Keeps roster, room code, name, stake config, leader.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const walletAddress = body?.walletAddress as string | undefined;
    const codeRaw       = body?.code as string | undefined;

    if (!walletAddress || !codeRaw) {
      return NextResponse.json({ error: "Missing walletAddress or code" }, { status: 400 });
    }
    const code = codeRaw.trim().toUpperCase();

    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.status === "cancelled") {
      return NextResponse.json({ error: "Room already cancelled" }, { status: 409 });
    }
    if (!findPlayer(room, walletAddress)) {
      return NextResponse.json({ error: "You are not in this room" }, { status: 403 });
    }
    if (!isLeader(room, walletAddress)) {
      return NextResponse.json({ error: "Only the leader can reset the room" }, { status: 403 });
    }

    room.roundId = generateRoundId();
    room.status = "lobby";
    for (const p of room.players) {
      p.staked = false;
      p.status = "unready";
    }
    await saveRoom(room);

    // Old round keys are now orphaned — let Redis TTL clean them up.
    // The new roundId has no keys yet; leader starting will seed them via /api/rooms/start.
    return NextResponse.json({ room });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("rooms/reset error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
