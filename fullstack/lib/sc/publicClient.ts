import { createPublicClient, http } from "viem";
import { monadTestnet } from "./wagmi";

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});
