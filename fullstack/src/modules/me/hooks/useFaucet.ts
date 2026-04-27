"use client";

import { useState } from "react";
import { useWriteContract, useReadContract } from "wagmi";
import { USDC_ADDRESS, usdcAbi } from "@/lib/sc/contracts";
import { showErrorToast, showSuccessToast } from "@/src/utils/toast";

export function useFaucet(address: string | null, onSuccess?: () => void) {
  const { writeContractAsync } = useWriteContract();
  const [minting, setMinting] = useState(false);
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));

  const { data: nextClaimRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "nextClaimAt",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const canClaim =
    !nextClaimRaw ||
    Number(nextClaimRaw) === 0 ||
    Number(nextClaimRaw) <= nowTs;

  const mint = async () => {
    if (!canClaim) return;
    try {
      setMinting(true);
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: usdcAbi,
        functionName: "mintFaucet",
      });
      showSuccessToast("Faucet mint submitted", {
        description: "100 USDC is on the way to your wallet.",
        id: "faucet-mint-submitted",
      });
      setTimeout(() => onSuccess?.(), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Cooldown")) {
        showErrorToast("Faucet cooldown active", {
          description: "Try again in 24 hours.",
          id: "faucet-cooldown",
        });
      } else {
        showErrorToast("Mint failed", {
          description: msg,
          id: `faucet-error:${msg}`,
        });
      }
    } finally {
      setMinting(false);
    }
  };

  return { minting, canClaim, mint };
}
