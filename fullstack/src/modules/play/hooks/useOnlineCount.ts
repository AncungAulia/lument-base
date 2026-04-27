"use client";

import { useEffect, useState } from "react";

export function useOnlineCount(address: string | null): number | null {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    const ping = () => {
      const url = address
        ? `/api/players/online?walletAddress=${address}`
        : `/api/players/online`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => setOnlineCount(d.online))
        .catch(() => {});
    };
    ping();
    const id = setInterval(ping, 30_000);
    return () => clearInterval(id);
  }, [address]);

  return onlineCount;
}
