"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { useWallet } from "@/src/provider/WalletContext";
import {
  GAME_ADDRESS,
  USDC_ADDRESS,
  gameAbi,
  usdcAbi,
} from "@/lib/sc/contracts";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/src/components/layouts/AppLayout";
import ProfileCard from "./components/ProfileCard";
import BalanceCard from "./components/BalanceCard";
import StatsGrid from "./components/StatsGrid";
import RecentRounds from "./components/RecentRounds";
import EditNameModal from "./components/EditNameModal";
import { useProfile } from "./hooks/useProfile";
import { useFaucet } from "./hooks/useFaucet";
import { updateDisplayName } from "./services/profile.service";
import { EMPTY_PROFILE } from "./types/profile.types";
import { showSuccessToast } from "@/src/utils/toast";

export default function MePage() {
  const { address, disconnect, displayName, refreshProfile } = useWallet();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState<string | null>(null);

  const { profileData, loading: profileLoading, reload } = useProfile(address);

  const { data: walletBalanceRaw, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const { data: claimableRaw } = useReadContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "balances",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const walletBalance = walletBalanceRaw ? Number(walletBalanceRaw) / 1e6 : 0;
  const claimable = claimableRaw ? Number(claimableRaw) / 1e6 : 0;

  const { minting, canClaim, mint } = useFaucet(address, () =>
    refetchBalance(),
  );

  const displayedProfile = address ? profileData : EMPTY_PROFILE;

  const openNameEditor = () => {
    setNameInput(displayName ?? "");
    setEditingName(true);
  };

  const handleSaveName = async (name: string) => {
    if (!address) return;
    const res = await updateDisplayName(address, name);
    if (res.error) throw new Error(res.error);
    await refreshProfile();
    await reload();
    showSuccessToast("Username updated", {
      description: "Your new name will appear across lobbies and leaderboards.",
      id: "username-updated",
    });
    setEditingName(false);
    setNameInput(null);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto page-enter">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading text-foreground">Me</h1>
            <p className="text-foreground/60 text-sm">
              Your color-matching stats
            </p>
          </div>
          <Badge className="bg-chart-2 text-main-foreground">CONNECTED</Badge>
        </div>

        {address && (
          <ProfileCard
            address={address}
            displayName={displayName}
            onEditName={openNameEditor}
            onDisconnect={disconnect}
          />
        )}

        <BalanceCard
          walletBalance={walletBalance}
          claimable={claimable}
          minting={minting}
          canClaim={canClaim}
          onMint={mint}
        />

        <StatsGrid profile={displayedProfile} />
        <RecentRounds profile={displayedProfile} loading={profileLoading} />
      </div>

      {editingName && address && (
        <EditNameModal
          currentName={nameInput ?? displayName ?? ""}
          displayName={displayName}
          onSave={handleSaveName}
          onClose={() => {
            setEditingName(false);
            setNameInput(null);
          }}
        />
      )}
    </AppLayout>
  );
}
