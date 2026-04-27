export async function joinMatchmakingQueue(
  walletAddress: string,
  mode: number,
): Promise<{ matched: boolean; roundId?: string; players?: string[]; queueCount?: number; error?: string }> {
  const res = await fetch("/api/matchmaking/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, mode }),
  });
  return res.json();
}

export async function pollMatchmakingStatus(
  walletAddress: string,
  mode: number,
): Promise<{ matched: boolean; roundId?: string; players?: string[]; queueCount?: number }> {
  const res = await fetch(
    `/api/matchmaking/status?walletAddress=${walletAddress}&mode=${mode}`,
  );
  return res.json();
}

export async function cancelMatchmaking(
  walletAddress: string,
  mode: number,
): Promise<{ success: boolean; playerState?: string; queueState?: { removed: boolean }; refundTx?: string | null }> {
  const res = await fetch("/api/matchmaking/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, mode }),
  });
  return res.json();
}

export function cancelMatchmakingBeacon(
  walletAddress: string,
  mode: number,
): void {
  const payload = JSON.stringify({ walletAddress, mode });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/matchmaking/cancel",
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return;
  }
  fetch("/api/matchmaking/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

// ── Matched-lobby leave (Feature 1) ────────────────────────────────────────

export async function leaveMatchedLobby(
  walletAddress: string,
  roundId: string,
): Promise<{ success: boolean; playerState?: string; refundTx?: string | null }> {
  const res = await fetch("/api/matchmaking/leave-matched", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, roundId }),
  });
  return res.json();
}

// sendBeacon variant — used on beforeunload / pagehide so the request survives
// the page being torn down.
export function leaveMatchedBeacon(walletAddress: string, roundId: string): void {
  const payload = JSON.stringify({ walletAddress, roundId });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      "/api/matchmaking/leave-matched",
      new Blob([payload], { type: "application/json" }),
    );
    if (sent) return;
  }
  fetch("/api/matchmaking/leave-matched", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

// Polled by the opponent every 2 s to detect "player_left_staked" events.
export async function pollMatchedStatus(
  walletAddress: string,
  roundId: string,
): Promise<{
  cancelled: boolean;
  reason?: string;
  leftBy?: string | null;
  refundTx?: string | null;
  playerState?: string;
}> {
  const res = await fetch(
    `/api/matchmaking/matched-status?walletAddress=${encodeURIComponent(walletAddress)}&roundId=${encodeURIComponent(roundId)}`,
  );
  return res.json();
}
