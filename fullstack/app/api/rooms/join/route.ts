import { NextResponse } from "next/server";
import {
  getRoom, saveRoom, bindPlayerToRoom, findPlayer, getPlayerRoomCode, unbindPlayer,
} from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const walletAddress = body?.walletAddress as string | undefined;
    const codeRaw = body?.code as string | undefined;

    if (!walletAddress || !codeRaw) {
      return NextResponse.json({ error: "Missing walletAddress or code" }, { status: 400 });
    }
    const code = codeRaw.trim().toUpperCase();

    const existingCode = await getPlayerRoomCode(walletAddress);
    if (existingCode && existingCode !== code) {
      const prev = await getRoom(existingCode);
      if (prev && prev.status === "lobby") {
        return NextResponse.json({ error: "You are still in another room", code: existingCode }, { status: 409 });
      }
      if (!prev || prev.status !== "lobby") {
        await unbindPlayer(walletAddress);
      }
    }

    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.status !== "lobby") {
      return NextResponse.json({ error: "This room is no longer accepting joins" }, { status: 409 });
    }

    if (findPlayer(room, walletAddress)) {
      return NextResponse.json({ room });
    }

    if (room.players.length >= room.maxPlayers) {
      return NextResponse.json({ error: "Room is full" }, { status: 409 });
    }

    room.players.push({
      address: walletAddress,
      status: "unready",
      staked: false,
      joinedAt: Date.now(),
    });

    await saveRoom(room);
    await bindPlayerToRoom(walletAddress, code);

    return NextResponse.json({ room });
  } catch (err: unknown) {
    console.error("rooms/join error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
