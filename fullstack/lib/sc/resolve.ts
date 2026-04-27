import {
  createWalletClient,
  createPublicClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GAME_ADDRESS, gameAbi } from "./contracts";
import { baseSepolia } from "./wagmi";

const CHAIN_ID = 84532;

export const signerAccount = privateKeyToAccount(
  process.env.SIGNER_PRIVATE_KEY as `0x${string}`,
);

const backendAccount = privateKeyToAccount(
  process.env.BACKEND_PRIVATE_KEY as `0x${string}`,
);

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

export const walletClient = createWalletClient({
  account: backendAccount,
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

export function toTierEnum(tierName: string): number {
  switch (tierName) {
    case "JACKPOT":
      return 4;
    case "GREAT":
      return 3;
    case "GOOD":
      return 2;
    default:
      return 0;
  }
}

export async function signAndResolve(
  roundId: string,
  winners: `0x${string}`[],
  rewards: bigint[],
  tiers: number[],
  scores: bigint[],
  devRake: bigint,
  soloRake: bigint,
  drainSoloReserve: boolean,
): Promise<{ txHash: string; resolved: boolean }> {
  const roundIdHex = roundId as `0x${string}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 5 * 60);
  const totalRewards = rewards.reduce((sum, reward) => sum + reward, BigInt(0));

  if (drainSoloReserve && totalRewards > BigInt(0)) {
    const reserveBalance = (await publicClient.readContract({
      address: GAME_ADDRESS,
      abi: gameAbi,
      functionName: "soloReserveBalance",
    })) as bigint;

    if (totalRewards > reserveBalance) {
      throw new Error(
        `Solo reserve insufficient: need ${Number(totalRewards) / 1_000_000} USDC, have ${Number(reserveBalance) / 1_000_000} USDC`,
      );
    }
  }

  const hash = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, address[], uint256[], uint8[], uint256[], uint256, uint256, bool, uint256, address, uint256",
      ),
      [
        roundIdHex,
        winners,
        rewards,
        tiers,
        scores,
        devRake,
        soloRake,
        drainSoloReserve,
        deadline,
        GAME_ADDRESS,
        BigInt(CHAIN_ID),
      ],
    ),
  );

  const signature = await signerAccount.signMessage({ message: { raw: hash } });
  const args = [
    roundIdHex,
    winners,
    rewards,
    tiers,
    scores,
    devRake,
    soloRake,
    drainSoloReserve,
    deadline,
    signature,
  ] as const;

  const ethBalance = await publicClient.getBalance({ address: backendAccount.address });
  if (ethBalance === BigInt(0)) {
    throw new Error(
      `Backend wallet ${backendAccount.address} has 0 ETH on chain ${CHAIN_ID}. Fund it with Base Sepolia ETH to pay for gas.`,
    );
  }

  await publicClient.simulateContract({
    account: backendAccount,
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "resolveRound",
    args,
  });

  const txHash = await walletClient.writeContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "resolveRound",
    args,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  if (receipt.status !== "success") {
    throw new Error(`resolveRound transaction reverted: ${txHash}`);
  }

  return { txHash, resolved: receipt.status === "success" };
}

export type PlayerScore = {
  address: string;
  accuracy: number;
  tier: string;
  score: number;
  timeSec?: number;
  guess?: { h: number; s: number; l: number };
};
