"use client";

import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import {
  GAME_ADDRESS,
  USDC_ADDRESS,
  gameAbi,
  usdcAbi,
} from "@/lib/sc/contracts";
import { showErrorToast, showSuccessToast } from "@/src/utils/toast";

export function usePayout(address: string | null) {
  const { writeContractAsync } = useWriteContract();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: claimableRaw, refetch: refetchClaimable } = useReadContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "balances",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: walletBalanceRaw, refetch: refetchWallet } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: reserveRaw } = useReadContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "soloReserveBalance",
  });

  const claimable = claimableRaw ? Number(claimableRaw) / 1e6 : 0;
  const walletBalance = walletBalanceRaw ? Number(walletBalanceRaw) / 1e6 : 0;
  const reserveBalance = reserveRaw ? Number(reserveRaw) / 1e6 : 0;

  const claim = async () => {
    if (!address || claimable <= 0) return;
    try {
      setClaiming(true);
      setError(null);
      await writeContractAsync({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: "withdraw",
      });
      showSuccessToast("Payout submitted", {
        description:
          "Your withdrawal is on-chain. Balance will refresh shortly.",
        id: "payout-claim-submitted",
      });
      setTimeout(() => {
        refetchClaimable();
        refetchWallet();
      }, 2000);
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      const message = e?.shortMessage || e?.message || "Unknown error";
      setError(message);
      showErrorToast("Claim failed", {
        description: message,
        id: `payout-claim-error:${message}`,
      });
    } finally {
      setClaiming(false);
    }
  };

  return { claimable, walletBalance, reserveBalance, claiming, error, claim };
}
