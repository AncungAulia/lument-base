"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { hslCss } from "@/src/utils/color";
import type { HSL } from "@/src/utils/color";
import type { Mode } from "../types/play.types";

function tierBgClass(name: string): string {
  switch (name) {
    case "JACKPOT": return "bg-chart-1 text-white";
    case "GREAT":   return "bg-chart-2 text-white";
    case "GOOD":    return "bg-chart-3 text-foreground";
    default:        return "bg-chart-4 text-white";
  }
}

export default function WaitingScene({
  myAccuracy,
  myTier,
  mode,
  target,
  guess,
  onCancel,
}: {
  myAccuracy: number;
  myTier: { name: string; payout: number; color: string };
  mode: Mode;
  target: HSL;
  guess: HSL;
  onCancel?: () => void;
}) {
  const [displayAcc, setDisplayAcc] = useState(0);

  useEffect(() => {
    const duration = 1000;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setDisplayAcc((1 - Math.pow(2, -10 * progress)) * myAccuracy);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [myAccuracy]);

  return (
    <div className="game-zone max-w-3xl mx-auto page-enter">
      {/* Colour split-screen — same structure as ResultScene */}
      <div
        className="relative w-full rounded-2xl overflow-hidden border-2 border-border shadow-shadow flex flex-col"
        style={{ minHeight: "min(65vh,550px)" }}
      >

        {/* Top half — player's guess */}
        <div
          className="relative flex-1 p-6 flex flex-col justify-between"
          style={{ background: hslCss(guess) }}
        >
          <div className="flex justify-end items-start w-full">
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-150 fill-mode-both flex flex-col items-end text-right">
              <div className="text-[64px] sm:text-[80px] font-heading text-white leading-none flex items-baseline justify-end gap-1">
                {displayAcc.toFixed(1)}
                <span className="text-3xl text-white/60">%</span>
              </div>
              <div className="mt-2">
                <Badge className={`${tierBgClass(myTier.name)} text-sm px-3 py-1`}>
                  {myTier.name}
                </Badge>
              </div>
            </div>
          </div>
          <div>
            <p className="text-white/50 text-xs mb-1 uppercase tracking-wider">Your selection</p>
            <p className="text-white font-heading text-sm">
              H{Math.round(guess.h)} S{Math.round(guess.s)} L{Math.round(guess.l)}
            </p>
          </div>
        </div>

        {/* Bottom half — target colour */}
        <div
          className="relative flex-1 p-6 flex flex-col justify-between"
          style={{ background: hslCss(target) }}
        >
          {/* Waiting indicator top-right */}
          <div className="flex justify-end">
            <div className="bg-black/20 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white/70 animate-blink"
                    style={{ animationDelay: `${i * 0.25}s` }}
                  />
                ))}
              </div>
              <p className="text-white/80 text-xs font-heading uppercase tracking-wider">
                Waiting for others
              </p>
            </div>
          </div>

          <div>
            <p className="text-white/50 text-xs mb-1 uppercase tracking-wider">Target</p>
            <p className="text-white font-heading text-sm">
              H{Math.round(target.h)} S{Math.round(target.s)} L{Math.round(target.l)}
            </p>
          </div>
        </div>
      </div>

      {onCancel && (
        <Button
          variant="neutral"
          className="w-full gap-2 mt-3 bg-chart-4! text-white hover:bg-chart-4/90!"
          onClick={onCancel}
        >
          <X className="w-4 h-4" /> Leave
        </Button>
      )}
    </div>
  );
}
