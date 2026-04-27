"use client";

import { ArrowUpFromLine, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UsdcIcon from "@/src/components/elements/UsdcIcon";
import { formatUsdc } from "@/src/utils/utils";
import { useWallet } from "@/src/provider/WalletContext";
import { usePayout } from "./hooks/usePayout";

export default function Payout() {
  const { address, isConnected } = useWallet();
  const { claimable, walletBalance, claiming, claim } = usePayout(address);

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-foreground">Payout</h1>
          <p className="text-foreground/60 text-sm">Withdraw your winnings</p>
        </div>
        <Badge className="bg-chart-2 text-main-foreground">
          {isConnected ? "CONNECTED" : "OFFLINE"}
        </Badge>
      </div>

      <Card className="mb-6 bg-main/10">
        <CardHeader>
          <CardDescription>CLAIMABLE BALANCE</CardDescription>
          <CardTitle className="flex items-center gap-2 text-4xl">
            {formatUsdc(claimable)} <UsdcIcon size={28} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/60 mb-4">
            Win games to earn <UsdcIcon className="mx-1" />. Withdraw your
            payout anytime.
          </p>
          <Button
            className="w-full gap-2 text-lg"
            size="lg"
            onClick={claim}
            disabled={claiming || claimable <= 0}
          >
            {claiming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Claiming...
              </>
            ) : (
              <>
                <ArrowUpFromLine className="w-5 h-5" />
                {claimable > 0 ? (
                  <span className="inline-flex items-center gap-2">
                    Claim {formatUsdc(claimable)} <UsdcIcon />
                  </span>
                ) : (
                  "Nothing to Claim"
                )}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-chart-3/30">
          <CardContent className="pt-3">
            <p className="text-xs font-heading text-foreground/60">
              YOUR WALLET BALANCE
            </p>
            <p className="text-2xl font-heading text-foreground">
              {formatUsdc(walletBalance)} <UsdcIcon size={25} />
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
