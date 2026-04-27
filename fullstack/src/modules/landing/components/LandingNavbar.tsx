"use client";

import { Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/src/provider/WalletContext";

export default function LandingNavbar({ onPlay }: { onPlay: () => void }) {
  const { isConnected } = useWallet();

  return (
    <nav className="sticky top-0 z-50 bg-secondary-background border-b-2 border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-base bg-main border-2 border-border shadow-shadow flex items-center justify-center">
              <span className="text-main-foreground font-heading text-sm">N</span>
            </div>
            <span className="font-heading text-xl text-foreground">Nadient</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onPlay} className="gap-2" variant={isConnected ? "default" : "neutral"}>
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
