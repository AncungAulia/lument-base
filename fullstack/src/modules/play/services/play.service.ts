import type { HSL, TargetDifficulty } from "@/src/utils/color";

export async function startRound(payload: {
  mode: string;
  tab: "play" | "practice";
  difficulty: TargetDifficulty;
}): Promise<{ roundId: string; target?: HSL }> {
  const res = await fetch("/api/play/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function submitGuess(payload: {
  target: HSL;
  guess: HSL;
  mode: string;
  roundId?: string;
  playerAddress?: string;
  isPractice: boolean;
  timeSec?: number;
}): Promise<{ resolved?: boolean; winner?: string; onChainError?: string }> {
  const res = await fetch("/api/play/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchRoundResult(
  roundId: string,
): Promise<{ resolved: boolean; winner?: string; allScores?: unknown[] }> {
  const res = await fetch(`/api/play/result?roundId=${roundId}`);
  return res.json();
}

export async function forceResolveRound(roundId: string): Promise<{
  resolved?: boolean;
  winner?: string;
  waiting?: boolean;
  resolving?: boolean;
  message?: string;
  onChainError?: string;
}> {
  const res = await fetch("/api/play/force-resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundId }),
  });
  return res.json();
}
