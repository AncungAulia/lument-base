import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { generateUniqueName } from "@/src/utils/names";

function sanitizeDisplayName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function tierLabelFromEnum(tier: number | null): string {
  switch (tier) {
    case 4:
      return "JACKPOT";
    case 3:
      return "GREAT";
    case 2:
      return "GOOD";
    default:
      return "MISS";
  }
}

function modeLabelFromEnum(mode: number | null): string {
  switch (mode) {
    case 1:
      return "1v1 Duel";
    case 2:
      return "Royale";
    default:
      return "Solo";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json(
      { error: "Missing walletAddress" },
      { status: 400 },
    );
  }

  const addr = walletAddress.toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("wallet_address", addr)
    .single();

  const { data: recentRows, error: historyError } = await supabaseAdmin
    .from("round_participants")
    .select(
      `
      accuracy,
      score,
      tier,
      reward_earned,
      is_winner,
      joined_at,
      rounds!inner (
        game_round_id,
        mode,
        source,
        status,
        created_at,
        resolved_at
      )
    `,
    )
    .eq("wallet_address", addr)
    .eq("rounds.status", "resolved")
    .order("resolved_at", { foreignTable: "rounds", ascending: false })
    .limit(20);

  if (historyError) {
    console.error("Failed to fetch round history:", historyError);
  }

  const recentRounds = (recentRows ?? []).map((row) => {
    const rounds = Array.isArray(row.rounds) ? row.rounds[0] : row.rounds;
    const accuracy = Number(row.accuracy ?? row.score ?? 0);
    const rewardEarned = Number(row.reward_earned ?? 0);
    const gameRoundId = String(rounds?.game_round_id ?? "");

    return {
      round: gameRoundId ? gameRoundId.slice(-4).toUpperCase() : "----",
      tier: tierLabelFromEnum(
        typeof row.tier === "number" ? row.tier : Number(row.tier ?? 0),
      ),
      mode: modeLabelFromEnum(
        typeof rounds?.mode === "number"
          ? rounds.mode
          : Number(rounds?.mode ?? 0),
      ),
      isFriends: rounds?.source === "private",
      payout: rewardEarned,
      acc: accuracy,
      isWinner: Boolean(row.is_winner),
      playedAt: rounds?.resolved_at ?? rounds?.created_at ?? row.joined_at,
    };
  });

  const totalEarned = recentRounds.reduce(
    (sum, round) => sum + round.payout,
    0,
  );
  const bestAccuracy = recentRounds.reduce(
    (best, round) => Math.max(best, round.acc),
    0,
  );
  let currentWinStreak = 0;
  for (const round of recentRounds) {
    if (round.payout > 0 || round.isWinner) currentWinStreak += 1;
    else break;
  }

  if (error || !data) {
    return NextResponse.json({
      wallet_address: walletAddress,
      display_name: null,
      total_earned: totalEarned,
      total_rounds_played: recentRounds.length,
      best_accuracy: bestAccuracy,
      current_win_streak: currentWinStreak,
      recent_rounds: recentRounds.slice(0, 5),
    });
  }

  return NextResponse.json({
    ...data,
    total_earned: totalEarned,
    total_rounds_played: recentRounds.length,
    best_accuracy: bestAccuracy,
    current_win_streak: currentWinStreak,
    recent_rounds: recentRounds.slice(0, 5),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 },
      );
    }

    const addr = walletAddress.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("wallet_address", addr)
      .single();

    if (existing) {
      return NextResponse.json(existing);
    }

    const displayName = generateUniqueName();

    const { data: newPlayer, error } = await supabaseAdmin
      .from("players")
      .insert({
        wallet_address: addr,
        display_name: displayName,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to register player:", error);
      return NextResponse.json({
        wallet_address: addr,
        display_name: displayName,
        total_earned: 0,
        total_rounds_played: 0,
        best_accuracy: 0,
        current_win_streak: 0,
        recent_rounds: [],
      });
    }

    return NextResponse.json(newPlayer);
  } catch (error: unknown) {
    console.error("API /me error:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const walletAddress = body?.walletAddress as string | undefined;
    const nextDisplayName = sanitizeDisplayName(body?.displayName);

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 },
      );
    }
    if (nextDisplayName.length < 3) {
      return NextResponse.json(
        { error: "Name must be at least 3 characters" },
        { status: 400 },
      );
    }
    if (!/^[A-Za-z0-9 _-]+$/.test(nextDisplayName)) {
      return NextResponse.json(
        { error: "Name may only contain letters, numbers, spaces, _ or -" },
        { status: 400 },
      );
    }

    const addr = walletAddress.toLowerCase();

    const { data: conflict } = await supabaseAdmin
      .from("players")
      .select("wallet_address")
      .ilike("display_name", nextDisplayName)
      .neq("wallet_address", addr)
      .limit(1)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json(
        { error: "That name is already used by another wallet" },
        { status: 409 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("players")
      .upsert(
        {
          wallet_address: addr,
          display_name: nextDisplayName,
        },
        { onConflict: "wallet_address" },
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to update player name:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("API /me PATCH error:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
