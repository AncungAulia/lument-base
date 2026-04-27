import type { HSL, TargetDifficulty } from "@/src/utils/color";

export type Phase =
  | "select"
  | "staking"
  | "queueing"
  | "matched"
  | "lobby"
  | "preview"
  | "guess"
  | "waiting"
  | "leaderboard"
  | "result";

export type Mode = "solo" | "duel" | "royale";
export type TabKey = "single" | "multi";

export type RoundResult = {
  winner: string;
  winnerAccuracy: number;
  winnerPayout: number;
  allScores: {
    address: string;
    accuracy: number;
    tier: string;
    score: number;
    timeSec?: number;
    guess?: HSL;
  }[];
  txHash?: string;
};

export type RoomPlayer = {
  address: string;
  status: "unready" | "ready";
  staked: boolean;
  joinedAt: number;
};

export type Room = {
  code: string;
  name: string;
  leader: string;
  maxPlayers: number;
  paid: boolean;
  stakeAmount: number;
  mode: 0 | 1 | 2;
  difficulty: TargetDifficulty;
  status: "lobby" | "active" | "resolved" | "cancelled";
  roundId: string;
  players: RoomPlayer[];
  createdAt: number;
  lastActivity: number;
};

export const MODE_META: Record<Mode, { label: string; stake: number; pool: number }> = {
  solo: { label: "SOLO", stake: 5, pool: 0 },
  duel: { label: "1 vs 1 DUEL", stake: 10, pool: 20 },
  royale: { label: "5 PLAYER ROYALE", stake: 10, pool: 50 },
};

export const MODE_NUM: Record<Mode, number> = { solo: 0, duel: 1, royale: 2 };

export const REQUIRED_PLAYERS: Record<"duel" | "royale", number> = {
  duel: 2,
  royale: 5,
};

export const DIFFICULTY_OPTIONS: TargetDifficulty[] = ["easy", "medium", "hard", "god"];

export const DIFFICULTY_LABEL: Record<TargetDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  god: "GOD",
};

export const USDC_DECIMALS = BigInt(1_000_000);
export const ONE_BILLION_USDC = BigInt(1_000_000_000) * USDC_DECIMALS;

export const STAKE_AMOUNT: Record<Mode, bigint> = {
  solo: BigInt(5) * USDC_DECIMALS,
  duel: BigInt(10) * USDC_DECIMALS,
  royale: BigInt(10) * USDC_DECIMALS,
};
