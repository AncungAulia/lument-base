"use client";

import { Coins, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UsdcIcon from "@/src/components/elements/UsdcIcon";
import { formatUsdc } from "@/src/utils/utils";

export default function BalanceCard({
  walletBalance,
  claimable,
  minting,
  canClaim,
  onMint,
}: {
  walletBalance: number;
  claimable: number;
  minting: boolean;
  canClaim: boolean;
  onMint: () => void;
}) {
  return (
    <Card className="mb-6 bg-chart-5/10">
      <CardContent className="pt-6 flex items-center justify-between">
        <div>
          <p className="font-heading text-foreground text-sm">Balance</p>
          <p className="flex items-center gap-2 text-2xl font-heading text-foreground">
            {formatUsdc(walletBalance)} <UsdcIcon size={22} />
          </p>
          {claimable > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-chart-2">
              +{formatUsdc(claimable)} <UsdcIcon size={12} /> ready in Payout
            </p>
          )}
        </div>
        <Button size="sm" className="gap-1" onClick={onMint} disabled={minting || !canClaim}>
          {minting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Coins className="w-4 h-4" />
          )}
          {canClaim ? (
            <span className="inline-flex items-center gap-2">Mint 100 <UsdcIcon /></span>
          ) : (
            "Cooldown"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
