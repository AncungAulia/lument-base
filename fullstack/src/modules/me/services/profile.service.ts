import { ProfileData } from "../types/profile.types";

export async function fetchProfile(walletAddress: string): Promise<ProfileData> {
  const res = await fetch(`/api/me?walletAddress=${walletAddress}`);
  const data = await res.json();
  return {
    total_earned: Number(data?.total_earned ?? 0),
    total_rounds_played: Number(data?.total_rounds_played ?? 0),
    best_accuracy: Number(data?.best_accuracy ?? 0),
    current_win_streak: Number(data?.current_win_streak ?? 0),
    recent_rounds: Array.isArray(data?.recent_rounds) ? data.recent_rounds : [],
  };
}

export async function updateDisplayName(
  walletAddress: string,
  displayName: string,
): Promise<{ error?: string }> {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, displayName }),
  });
  return res.json();
}
