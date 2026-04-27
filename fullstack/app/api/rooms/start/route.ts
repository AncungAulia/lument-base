import { NextResponse } from "next/server";
import { redis } from "@/lib/db/redis";
import { getRoom, saveRoom, isLeader, generateRoundId } from "@/lib/rooms";
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
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (!isLeader(room, walletAddress)) {
      return NextResponse.json(
        { error: "Only the leader can start the room" },
        { status: 403 },
      );
    }
    if (room.status !== "lobby") {
      return NextResponse.json(
        { error: "Room is not in the lobby" },
        { status: 409 },
      );
    }
    if (room.players.length < room.maxPlayers) {
      return NextResponse.json(
        {
          error: `Room is not full yet (${room.players.length}/${room.maxPlayers})`,
        },
        { status: 409 },
      );
    }
    if (!room.players.every((p) => p.status === "ready")) {
      return NextResponse.json(
        { error: "All players must be ready" },
        { status: 409 },
      );
    }
    if (room.paid && !room.players.every((p) => p.staked)) {
      return NextResponse.json(
        { error: "All players must stake before starting" },
        { status: 409 },
      );
    }

    if (!room.roundId) room.roundId = generateRoundId();

    room.status = "active";
    await saveRoom(room, false);

    const addresses = room.players.map((p) => p.address);
    await redis.set(
      `round:${room.roundId}:players`,
      JSON.stringify(addresses),
      { ex: 3600 },
    );
    await redis.set(
      `round:${room.roundId}:meta`,
      JSON.stringify({
        casual: !room.paid,
        stakeAmount: room.stakeAmount,
        difficulty: room.difficulty,
        source: "private",
      }),
      { ex: 3600 },
    );

    try {
      const { data: round } = await supabaseAdmin
        .from("rounds")
        .insert({
          game_round_id: room.roundId.toLowerCase(),
          mode: room.mode,
          source: "private",
          status: "matched",
        })
        .select("id")
        .single();

      if (round) {
        await supabaseAdmin.from("round_participants").insert(
          addresses.map((a) => ({
            round_id: round.id,
            wallet_address: a.toLowerCase(),
          })),
        );
        await supabaseAdmin
          .from("rooms")
          .update({ status: "active", round_id: round.id })
          .eq("code", room.code);
      }
    } catch (e) {
      console.warn("supabase logging failed (non-fatal):", e);
    }

    return NextResponse.json({ room });
  } catch (err: unknown) {
    console.error("rooms/start error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
