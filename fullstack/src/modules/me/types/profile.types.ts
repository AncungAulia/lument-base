export type ProfileRound = {
  round: string;
  tier: string;
  mode: string;
  isFriends?: boolean;
  payout: number;
  acc: number;
  isWinner?: boolean;
  playedAt?: string;
};

export type ProfileData = {
  total_earned: number;
  total_rounds_played: number;
  best_accuracy: number;
  current_win_streak: number;
  recent_rounds: ProfileRound[];
};

export const EMPTY_PROFILE: ProfileData = {
  total_earned: 0,
  total_rounds_played: 0,
  best_accuracy: 0,
  current_win_streak: 0,
  recent_rounds: [],
};
