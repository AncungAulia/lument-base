"use client";

import { ArrowRight, Shield, Trophy, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/src/provider/WalletContext";

export default function HeroSection({ onPlay }: { onPlay: () => void }) {
  const { isConnected } = useWallet();

  return (
    <section className="landing-hero px-4">
      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <div className="hidden md:block absolute -left-32 top-8">
          <div data-mouse-track data-depth="1.6" className="w-20 h-20 color-swatch transform-gpu will-change-transform" style={{ background: "hsl(280, 70%, 60%)" }} />
        </div>
        <div className="hidden md:block absolute -right-28 top-20">
          <div data-mouse-track data-depth="2.2" className="w-16 h-16 color-swatch transform-gpu will-change-transform" style={{ background: "hsl(160, 65%, 50%)" }} />
        </div>
        <div className="hidden md:block absolute -left-20 bottom-24">
          <div data-mouse-track data-depth="1.2" className="w-14 h-14 color-swatch transform-gpu will-change-transform" style={{ background: "hsl(40, 90%, 65%)" }} />
        </div>

        <Badge data-gsap-reveal className="mb-6 text-sm">Color Memory Game on Base</Badge>
        <h1 data-gsap-reveal className="text-5xl sm:text-6xl lg:text-7xl font-heading leading-tight mb-6 text-foreground">
          Trust Your Eyes.<br />
          <span className="inline-flex items-center gap-3 text-main">Win USDC.</span>
        </h1>
        <p data-gsap-reveal className="text-lg sm:text-xl text-foreground/70 mb-10 max-w-xl mx-auto font-base">
          We show you a color. You recreate it from memory. The closer your match, the more you earn. Simple, addictive, on-chain.
        </p>
        <div data-gsap-reveal className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button data-kinetic size="lg" className="text-lg px-10 py-6 gap-2 transform-gpu" onClick={onPlay} variant={isConnected ? "default" : "neutral"}>
            {isConnected ? (
              <><Zap className="w-5 h-5" /> Play Now <ArrowRight className="w-5 h-5" /></>
            ) : (
              <><Shield className="w-5 h-5" /> Connect Wallet <ArrowRight className="w-5 h-5" /></>
            )}
          </Button>
          <Button data-kinetic variant="neutral" size="lg" className="text-lg px-8 py-6 gap-2 transform-gpu" asChild>
            <a href="#how-it-works">Learn More</a>
          </Button>
        </div>
        <div data-gsap-reveal className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm text-foreground/60">
          <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 127 players online</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Trophy className="w-4 h-4" /> $12,480 jackpot</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> No-loss protocol</span>
        </div>
      </div>
    </section>
  );
}
