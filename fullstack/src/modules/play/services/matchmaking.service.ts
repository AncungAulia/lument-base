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
): Promise<void> {
  await fetch("/api/matchmaking/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, mode }),
  });
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
