"use client";

import { Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/src/provider/WalletContext";
import { LumentLogo } from "@/src/components/LumentLogo";

export default function LandingNavbar({ onPlay }: { onPlay: () => void }) {
  const { isConnected } = useWallet();

  return (
    <nav className="sticky top-0 z-50 bg-secondary-background border-b-2 border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <LumentLogo className="w-8 h-8" />
            <span className="font-heading text-xl text-foreground">Lument</span>
          </div>
          <div className="flex items-center gap-2">
            <Button data-kinetic onClick={onPlay} className="gap-2 transform-gpu" variant={isConnected ? "default" : "neutral"}>
              {isConnected ? (
                <><Zap className="w-4 h-4" /> Play Now</>
              ) : (
                <><Shield className="w-4 h-4" /> Connect Wallet</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
