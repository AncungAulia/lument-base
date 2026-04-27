import { NextResponse } from "next/server";
import { getRoom, touchRoomHeartbeat, findPlayer } from "@/lib/rooms";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get("walletAddress");

    const room = await getRoom(code);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // heartbeat: bump TTL only if caller is still in the room
    if (walletAddress && findPlayer(room, walletAddress)) {
      await touchRoomHeartbeat(code, walletAddress);
    }

    return NextResponse.json({ room });
  } catch (err: any) {
    console.error("rooms/[code] error:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
