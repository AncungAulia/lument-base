"use client";

import { useCallback, useRef, useState } from "react";
import {
  joinMatchmakingQueue,
  pollMatchmakingStatus,
  cancelMatchmaking,
  cancelMatchmakingBeacon,
} from "../services/matchmaking.service";
import type { Mode, RoundResult } from "../types/play.types";
import { MODE_NUM } from "../types/play.types";

export function useMatchmaking(
  address: string | null,
  onMatched: (roundId: string, players: string[], modeEnum: number) => void,
) {
  const [queueCount, setQueueCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startQueuePolling = useCallback(
    (modeNum: number) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        if (!address) return;
        try {
          const res = await pollMatchmakingStatus(address, modeNum);
          if (res.matched && res.roundId) {
            stopPolling();
            onMatched(res.roundId, res.players ?? [], modeNum);
          } else {
            setQueueCount(res.queueCount ?? 0);
          }
        } catch {}
      }, 3000);
    },
    [address, onMatched, stopPolling],
  );

  const joinQueue = useCallback(
    async (queueMode: "duel" | "royale") => {
      if (!address) {
        setError("Connect your wallet to play.");
        return false;
      }
      const modeNum = MODE_NUM[queueMode];
      setError(null);
      setQueueCount(1);

      try {
        const res = await joinMatchmakingQueue(address, modeNum);
        if (res.error) {
          setError(res.error);
          return false;
        }
        if (res.matched && res.roundId) {
          onMatched(res.roundId, res.players ?? [], modeNum);
          // Return "matched" so the caller knows NOT to set phase="queueing"
          return "matched" as const;
        }
        setQueueCount(res.queueCount ?? 1);
        startQueuePolling(modeNum);
        return "queued" as const;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to join matchmaking");
        return null;
      }
    },
    [address, onMatched, startQueuePolling],
  );

  const cancelQueue = useCallback(
    async (mode: Mode) => {
      stopPolling();
      if (address) {
        try {
          await cancelMatchmaking(address, MODE_NUM[mode]);
        } catch {}
      }
    },
    [address, stopPolling],
  );

  const cleanupOnUnload = useCallback(
    (mode: Mode) => {
      if (address && (mode === "duel" || mode === "royale")) {
        cancelMatchmakingBeacon(address, MODE_NUM[mode]);
      }
    },
    [address],
  );

  return {
    queueCount,
    error,
    joinQueue,
    cancelQueue,
    cleanupOnUnload,
    stopPolling,
  };
}
