import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "viem/chains";

export { baseSepolia };

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
  ssr: true,
});
