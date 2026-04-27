"use client";

import { useCallback, useState } from "react";
import { useWriteContract } from "wagmi";
import { publicClient } from "@/lib/sc/publicClient";
import {
  GAME_ADDRESS,
  USDC_ADDRESS,
  gameAbi,
  usdcAbi,
} from "@/lib/sc/contracts";
import { ONE_BILLION_USDC } from "../types/play.types";

export type StakingStep = "approve" | "deposit";

// Monad testnet's RPC sometimes returns null for eth_estimateGas, causing viem
// to crash with "Cannot destructure property 'gasLimit' … is null". Explicit
// gas limits bypass estimation entirely.
const GAS_APPROVE  = BigInt(120_000);
const GAS_DEPOSIT  = BigInt(500_000);

export function useStake(address: string | null) {
  const { writeContractAsync } = useWriteContract();
  const [needsApproval, setNeedsApproval] = useState(true);
  const [stakingStep, setStakingStep] = useState<StakingStep>("approve");

  const doStake = useCallback(
    async (roundId: string, modeEnum: number, amount: bigint) => {
      let needsApprove = true;
      try {
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: "allowance",
          args: [address as `0x${string}`, GAME_ADDRESS],
        });
        needsApprove = (allowance as bigint) < amount;
      } catch {}

      setNeedsApproval(needsApprove);
      setStakingStep("approve");

      if (needsApprove) {
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: "approve",
          args: [GAME_ADDRESS, ONE_BILLION_USDC],
          gas: GAS_APPROVE,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStakingStep("deposit");
      const depositHash = await writeContractAsync({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: "depositStake",
        args: [roundId as `0x${string}`, modeEnum, amount],
        gas: GAS_DEPOSIT,
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });
    },
    [address, writeContractAsync],
  );

  const readStakedPlayers = useCallback(async (roundId: string): Promise<string[]> => {
    const players = await publicClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: "getRoundPlayers",
      args: [roundId as `0x${string}`],
    });
    return ((players as string[]) ?? []).map((p) => p.toLowerCase());
  }, []);

  return { doStake, readStakedPlayers, needsApproval, stakingStep };
}
