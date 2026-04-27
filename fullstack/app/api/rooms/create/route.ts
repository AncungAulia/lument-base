import { NextResponse } from "next/server";
import {
  Room,
  generateRoomCode,
  generateRoundId,
  getRoom,
  saveRoom,
  bindPlayerToRoom,
  getPlayerRoomCode,
  modeForPlayerCount,
  sanitizeRoomName,
  unbindPlayer,
} from "@/lib/rooms";
import { supabaseAdmin } from "@/lib/db/supabase";

const ALLOWED_STAKES = [5, 10, 15, 20];
const ALLOWED_DIFFICULTIES = ["easy", "medium", "hard", "god"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { walletAddress, name, maxPlayers, paid, stakeAmount, difficulty } =
      body ?? {};

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 },
      );
    }
    const max = Number(maxPlayers);
    if (!Number.isInteger(max) || max < 2 || max > 5) {
      return NextResponse.json(
        { error: "maxPlayers must be between 2 and 5" },
        { status: 400 },
      );
    }
    const stake = Number(stakeAmount ?? 0);
    if (paid && !ALLOWED_STAKES.includes(stake)) {
      return NextResponse.json(
        { error: "stakeAmount must be 5, 10, 15, or 20" },
        { status: 400 },
      );
    }
    if (!ALLOWED_DIFFICULTIES.includes(String(difficulty ?? "medium"))) {
      return NextResponse.json(
        { error: "difficulty must be easy, medium, hard, or god" },
        { status: 400 },
      );
    }

    const existing = await getPlayerRoomCode(walletAddress);
    if (existing) {
      const prev = await getRoom(existing);
      if (prev && prev.status === "lobby") {
        return NextResponse.json(
          { error: "You are still in another room", code: existing },
          { status: 409 },
        );
      }
      await unbindPlayer(walletAddress);
    }

    let code = "";
    for (let i = 0; i < 5; i++) {
      const c = generateRoomCode();
      if (!(await getRoom(c))) {
        code = c;
        break;
      }
    }
    if (!code) {
      return NextResponse.json(
        { error: "Failed to generate a room code. Please try again." },
        { status: 500 },
      );
    }

    const now = Date.now();
    const room: Room = {
      code,
      name: sanitizeRoomName(name) || `Room ${code}`,
      leader: walletAddress,
      maxPlayers: max,
      paid: !!paid,
      stakeAmount: paid ? stake : 0,
      difficulty: String(difficulty ?? "medium") as Room["difficulty"],
      mode: modeForPlayerCount(max),
      status: "lobby",
      roundId: paid ? generateRoundId() : "",
      players: [
        {
          address: walletAddress,
          status: "unready",
          staked: false,
          joinedAt: now,
        },
      ],
      createdAt: now,
      lastActivity: now,
    };

    await saveRoom(room);
    await bindPlayerToRoom(walletAddress, code);

    try {
      await supabaseAdmin.from("rooms").insert({
        code: room.code,
        name: room.name,
        leader_wallet: room.leader.toLowerCase(),
        max_players: room.maxPlayers,
        paid: room.paid,
        status: room.status,
      });
    } catch (e) {
      console.warn("rooms insert failed (non-fatal):", e);
    }

    return NextResponse.json({ room });
  } catch (err: unknown) {
    console.error("rooms/create error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
