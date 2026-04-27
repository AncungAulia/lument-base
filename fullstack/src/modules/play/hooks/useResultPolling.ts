"use client";

import { useCallback, useRef } from "react";
import { fetchRoundResult, forceResolveRound } from "../services/play.service";
import type { RoundResult } from "../types/play.types";

export function useResultPolling(
  onResolved: (result: RoundResult) => void,
  onError: (msg: string) => void,
) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const waitForResult = useCallback(
    async (roundId: string, attempts = 8, delayMs = 2500) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await fetchRoundResult(roundId);
          if (res?.resolved) return res as unknown as RoundResult;
        } catch {}
        if (i < attempts - 1)
          await new Promise((r) => setTimeout(r, delayMs));
      }
      return null;
    },
    [],
  );

  const startPolling = useCallback(
    (roundId: string) => {
      stopPolling();
      let polls = 0;

      const id = setInterval(async () => {
        polls++;
        try {
          const res = await fetchRoundResult(roundId);
          if (res.resolved) {
            clearInterval(id);
            pollRef.current = null;
            onResolved(res as unknown as RoundResult);
            return;
          }
        } catch {}

        if (polls >= 23) {
          clearInterval(id);
          pollRef.current = null;
          try {
            const res = await forceResolveRound(roundId);
            if (res.resolved || res.winner) {
              onResolved(res as unknown as RoundResult);
            } else if (res.waiting || res.resolving || res.message === "Resolution in progress") {
              const result = await waitForResult(roundId);
              if (result) onResolved(result);
              else onError("Round resolution is still in progress. Check again shortly or open Payout.");
            } else if (res.onChainError) {
              onError(`Failed to resolve round: ${res.onChainError}`);
            } else {
              onError("Failed to resolve round. Check Payout to withdraw or request a refund.");
            }
          } catch {
            onError("Connection failed. Check Payout to withdraw or request a refund.");
          }
        }
      }, 2000);

      pollRef.current = id;
    },
    [stopPolling, waitForResult, onResolved, onError],
  );

  return { startPolling, stopPolling };
}
