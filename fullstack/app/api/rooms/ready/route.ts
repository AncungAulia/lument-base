import { NextResponse } from "next/server";
import { getRoom, saveRoom, findPlayer } from "@/lib/rooms";
import { readStake } from "@/lib/sc/refund";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const walletAddress = body?.walletAddress as string | undefined;
    const codeRaw = body?.code as string | undefined;
    const ready = body?.ready as boolean | undefined;

    if (!walletAddress || !codeRaw) {
      return NextResponse.json(
        { error: "Missing walletAddress or code" },
        { status: 400 },
      );
    }
    const code = codeRaw.trim().toUpperCase();

    const room = await getRoom(code);
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (room.status !== "lobby") {
      return NextResponse.json(
        { error: "Room is not in the lobby" },
        { status: 409 },
      );
    }

    const player = findPlayer(room, walletAddress);
    if (!player)
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 404 },
      );

    if (!room.paid) {
      player.status = ready === false ? "unready" : "ready";
      await saveRoom(room);
      return NextResponse.json({ room });
    }

    const required = BigInt(room.stakeAmount) * BigInt(1_000_000);
    const actual = await readStake(room.roundId, walletAddress);

    if (actual >= required) {
      player.status = "ready";
      player.staked = true;
      await saveRoom(room);
      return NextResponse.json({ room });
    }

    return NextResponse.json(
      {
        error:
          "Stake not detected on-chain yet. Wait for transaction confirmation or deposit your stake first.",
        staked: false,
      },
      { status: 402 },
    );
  } catch (err: unknown) {
    console.error("rooms/ready error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
