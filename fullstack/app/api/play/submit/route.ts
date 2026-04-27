import { NextResponse } from "next/server";
import {
  accuracyFromDeltaE,
  deltaE,
  tier,
  HSL,
  normalizeHsl,
} from "@/src/utils/color";
import { redis, parseRedisJson } from "@/lib/db/redis";
import { signAndResolve, toTierEnum, PlayerScore } from "@/lib/sc/resolve";
import { supabaseAdmin } from "@/lib/db/supabase";

function soloRewardAmount(tierName: string): {
  reward: bigint;
  tierEnum: number;
} {
  switch (tierName) {
    case "JACKPOT":
      return { reward: BigInt(10_000_000), tierEnum: 4 };
    case "GREAT":
      return { reward: BigInt(7_500_000), tierEnum: 3 };
    case "GOOD":
      return { reward: BigInt(6_000_000), tierEnum: 2 };
    default:
      return { reward: BigInt(0), tierEnum: 0 };
  }
}

function modeToEnum(mode: string, playerCount: number): number {
  if (mode === "solo") return 0;
  return playerCount <= 2 ? 1 : 2;
}

async function ensureRoundRecord(
  gameRoundId: string,
  modeEnum: number,
  players: string[],
  source: "solo" | "public" | "private",
): Promise<string | null> {
  const normalizedRoundId = gameRoundId.toLowerCase();
  const normalizedPlayers = players.map((walletAddress) => ({
    wallet_address: walletAddress.toLowerCase(),
  }));

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("rounds")
    .select("id")
    .eq("game_round_id", normalizedRoundId)
    .maybeSingle();

  if (fetchError) {
    console.warn("Failed to fetch round history row:", fetchError);
  }

  let roundDbId = existing?.id ?? null;

  if (!roundDbId) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("rounds")
      .insert({
        game_round_id: normalizedRoundId,
        mode: modeEnum,
        source,
        status: "matched",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.warn("Failed to create round history row:", insertError);
      return null;
    }

    roundDbId = inserted.id;
  }

  const { error: playersError } = await supabaseAdmin
    .from("players")
    .upsert(normalizedPlayers, { onConflict: "wallet_address" });

  if (playersError) {
    console.warn("Failed to upsert players for round history:", playersError);
  }

  const { error: participantsError } = await supabaseAdmin
    .from("round_participants")
    .upsert(
      normalizedPlayers.map((player) => ({
        round_id: roundDbId,
        wallet_address: player.wallet_address,
      })),
      { onConflict: "round_id,wallet_address" },
    );

  if (participantsError) {
    console.warn("Failed to seed round participants:", participantsError);
  }

  return roundDbId;
}

async function persistResolvedRound(params: {
  gameRoundId: string;
  mode: string;
  source: "solo" | "public" | "private";
  players: PlayerScore[];
  winnerAddress?: string | null;
  rewardByAddress: Record<string, number>;
  resolved: boolean;
}) {
  const {
    gameRoundId,
    mode,
    source,
    players,
    winnerAddress,
    rewardByAddress,
    resolved,
  } = params;
  const roundDbId = await ensureRoundRecord(
    gameRoundId,
    modeToEnum(mode, players.length),
    players.map((player) => player.address),
    source,
  );

  if (!roundDbId) return;

  const normalizedWinner = winnerAddress?.toLowerCase() ?? null;
  const participantRows = players.map((player) => {
    const normalizedAddress = player.address.toLowerCase();
    return {
      round_id: roundDbId,
      wallet_address: normalizedAddress,
      accuracy: player.accuracy,
      score: player.score,
      tier: toTierEnum(player.tier),
      reward_earned: rewardByAddress[normalizedAddress] ?? 0,
      is_winner: normalizedWinner === normalizedAddress,
    };
  });

  const { error: participantsError } = await supabaseAdmin
    .from("round_participants")
    .upsert(participantRows, { onConflict: "round_id,wallet_address" });

  if (participantsError) {
    console.warn("Failed to persist round participants:", participantsError);
  }

  const { error: roundError } = await supabaseAdmin
    .from("rounds")
    .update({
      status: resolved ? "resolved" : "pending_payout",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", roundDbId);

  if (roundError) {
    console.warn("Failed to update round history status:", roundError);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const rawTarget = body?.target as Partial<HSL> | undefined;
  const rawGuess = body?.guess as Partial<HSL> | undefined;
  const roundId = body?.roundId as string | undefined;
  const playerAddress = body?.playerAddress as string | undefined;
  const mode = (body?.mode ?? "solo") as string;
  const isPractice = body?.isPractice ?? false;
  const rawTime = body?.timeSec as number | undefined;
  const timeSec =
    typeof rawTime === "number" && isFinite(rawTime) && rawTime >= 0
      ? Math.min(rawTime, 60)
      : undefined;

  const target = normalizeHsl(rawTarget);
  const guess = normalizeHsl(rawGuess);
  const dE = deltaE(target, guess);
  const acc = accuracyFromDeltaE(dE);
  const t = tier(acc);

  const baseResult = {
    method: "deltaE",
    accuracy: acc,
    deltaE: dE,
    tier: t.name,
    payout: t.payout,
  };

  if (isPractice || !roundId || !playerAddress) {
    return NextResponse.json(baseResult);
  }

  // ── SOLO ─────────────────────────────────────────────────────────────────
  if (mode === "solo") {
    try {
      const { reward, tierEnum } = soloRewardAmount(t.name);
      const { txHash, resolved } = await signAndResolve(
        roundId,
        [playerAddress as `0x${string}`],
        [reward],
        [tierEnum],
        [BigInt(Math.round(acc * 100))],
        BigInt(0),
        BigInt(5_000_000),
        true,
      );
      await persistResolvedRound({
        gameRoundId: roundId,
        mode,
        source: "solo",
        players: [
          {
            address: playerAddress.toLowerCase(),
            accuracy: acc,
            tier: t.name,
            score: Math.round(acc * 100),
            timeSec,
            guess,
          },
        ],
        winnerAddress: reward > BigInt(0) ? playerAddress : null,
        rewardByAddress: {
          [playerAddress.toLowerCase()]: t.payout,
        },
        resolved,
      });
      return NextResponse.json({ ...baseResult, txHash, resolved });
    } catch (error: unknown) {
      console.error("Solo resolve error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ ...baseResult, onChainError: message });
    }
  }

  // ── MULTIPLAYER ───────────────────────────────────────────────────────────
  const addrLower = playerAddress.toLowerCase();

  console.log(
    `[submit] Player ${addrLower} submitting for round ${roundId}, mode=${mode}, acc=${acc.toFixed(1)}%`,
  );

  await redis.set(
    `round:${roundId}:score:${addrLower}`,
    JSON.stringify({
      address: addrLower,
      accuracy: acc,
      tier: t.name,
      score: Math.round(acc * 100),
      timeSec,
      guess,
    }),
    { ex: 3600 },
  );

  const players = parseRedisJson<string[]>(
    await redis.get(`round:${roundId}:players`),
  );
  if (!players) {
    console.warn(`[submit] round:${roundId}:players NOT FOUND in Redis`);
    return NextResponse.json({
      ...baseResult,
      waiting: true,
      message: "Round not found",
    });
  }
  // Use actual player count from Redis — friend rooms may have 2-5 players
  // regardless of the mode enum (duel=2, royale=3-5)
  const required = players.length;
  const scoreResults = await Promise.all(
    players.map((p) => redis.get(`round:${roundId}:score:${p.toLowerCase()}`)),
  );
  const submittedCount = scoreResults.filter(Boolean).length;

  console.log(
    `[submit] Round ${roundId}: submitted=${submittedCount}/${required}, players=${JSON.stringify(players)}`,
  );

  if (submittedCount < required) {
    return NextResponse.json({
      ...baseResult,
      waiting: true,
      submitted: submittedCount,
      required,
    });
  }

  return resolveMultiplayer(
    roundId,
    players,
    scoreResults as (string | null)[],
    required,
    baseResult,
  );
}

export async function resolveMultiplayer(
  roundId: string,
  players: string[],
  scoreResults: (string | null)[],
  required: number,
  baseResult: object,
) {
  const resultKey = `round:${roundId}:result`;
  const lockKey = `round:${roundId}:resolving`;

  const existingResult = parseRedisJson<object>(await redis.get(resultKey));
  if (existingResult) {
    return NextResponse.json({
      ...baseResult,
      resolved: true,
      ...existingResult,
    });
  }

  const locked = await redis.set(lockKey, "1", { ex: 120, nx: true });
  if (!locked) {
    const eventualResult = parseRedisJson<object>(await redis.get(resultKey));
    if (eventualResult) {
      return NextResponse.json({
        ...baseResult,
        resolved: true,
        ...eventualResult,
      });
    }
    return NextResponse.json({
      ...baseResult,
      waiting: true,
      resolving: true,
      message: "Resolution in progress",
    });
  }

  const allScores: PlayerScore[] = scoreResults
    .map((s) => parseRedisJson<PlayerScore>(s))
    .filter((x): x is PlayerScore => x !== null);
  allScores.sort((a, b) => b.accuracy - a.accuracy);
  const winner = allScores[0];

  // Per-round meta set by /api/rooms/start. Defaults preserve existing matchmaking rounds.
  const meta = parseRedisJson<{
    casual?: boolean;
    stakeAmount?: number;
    source?: "public" | "private";
  }>(await redis.get(`round:${roundId}:meta`));
  const casual = meta?.casual === true;
  const stakePerPlayer =
    BigInt((meta?.stakeAmount ?? 10) as number) * BigInt(1_000_000);
  const source = meta?.source === "private" ? "private" : "public";

  if (casual) {
    const resultData = {
      winner: winner.address,
      winnerAccuracy: winner.accuracy,
      winnerPayout: 0,
      allScores,
    };
    await redis.set(resultKey, JSON.stringify(resultData), { ex: 3600 });
    await persistResolvedRound({
      gameRoundId: roundId,
      mode: required <= 2 ? "duel" : "royale",
      source,
      players: allScores,
      winnerAddress: winner.address,
      rewardByAddress: {},
      resolved: true,
    });
    return NextResponse.json({
      ...baseResult,
      ...resultData,
      resolved: true,
      casual: true,
    });
  }

  const totalStake = BigInt(required) * stakePerPlayer;
  const winnerReward = (totalStake * BigInt(80)) / BigInt(100);
  const devRake = (totalStake * BigInt(10)) / BigInt(100);
  const soloRake = totalStake - winnerReward - devRake;

  try {
    const { txHash, resolved } = await signAndResolve(
      roundId,
      [winner.address as `0x${string}`],
      [winnerReward],
      [toTierEnum(winner.tier)],
      [BigInt(winner.score)],
      devRake,
      soloRake,
      false,
    );

    const resultData = {
      winner: winner.address,
      winnerAccuracy: winner.accuracy,
      winnerPayout: Number(winnerReward) / 1_000_000,
      allScores,
      txHash,
    };
    await redis.set(resultKey, JSON.stringify(resultData), { ex: 3600 });
    await persistResolvedRound({
      gameRoundId: roundId,
      mode: required <= 2 ? "duel" : "royale",
      source,
      players: allScores,
      winnerAddress: winner.address,
      rewardByAddress: {
        [winner.address.toLowerCase()]: Number(winnerReward) / 1_000_000,
      },
      resolved,
    });

    return NextResponse.json({ ...baseResult, ...resultData, resolved });
  } catch (error: unknown) {
    console.error("Multiplayer resolve error:", error);
    await redis.del(lockKey);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ...baseResult, onChainError: message });
  }
}
