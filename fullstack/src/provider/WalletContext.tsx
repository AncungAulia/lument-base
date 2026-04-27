"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config, monadTestnet } from "@/lib/sc/wagmi";

type WalletState = {
  isConnected: boolean;
  isReady: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
  displayName: string | null;
  refreshProfile: () => Promise<void>;
};

const WalletContext = createContext<WalletState>({
  isConnected: false,
  isReady: false,
  address: null,
  connect: () => {},
  disconnect: () => {},
  displayName: null,
  refreshProfile: async () => {},
});

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function WalletInner({ children }: { children: ReactNode }) {
  const { address, isConnected, status } = useAccount();
  const isReady = status !== "connecting" && status !== "reconnecting";
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!address) {
      setDisplayName(null);
      return;
    }
    try {
      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      const data = await res.json();
      setDisplayName(data.display_name ?? null);
    } catch (e) {
      console.error("Failed to register player:", e);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id });
    }
  }, [isConnected, chainId, switchChain]);

  useEffect(() => {
    if (!isConnected || !address) return;
    refreshProfile();
  }, [isConnected, address, refreshProfile]);

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === "injected");
    const connector = injected ?? connectors[0];
    if (connector) connect({ connector, chainId: monadTestnet.id });
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isReady,
        address: address ?? null,
        connect: handleConnect,
        disconnect,
        displayName: isConnected ? displayName : null,
        refreshProfile,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletInner>{children}</WalletInner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
