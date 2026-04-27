"use client";

import { useEffect, useState } from "react";
import { Check, Crown, RotateCcw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addrInitials, addrTone, toneBg, toneRing } from "@/src/utils/address";
import { fetchPlayerNames } from "../services/rooms.service";
import type { RoundResult, Mode } from "../types/play.types";
import confetti from "canvas-confetti";

export default function LeaderboardScene({
  result,
  myAddress,
  mode,
  onAgain,
}: {
  result: RoundResult;
  myAddress?: string;
  mode: Mode;
  onAgain: () => void;
}) {
  const scores = result.allScores ?? [];
  const n = scores.length;
  const [revealed, setRevealed] = useState(0);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string | null>>({});

  const REVEAL_START_MS = 600;
  const REVEAL_STEP_MS = 900;

  useEffect(() => {
    if (n === 0) return;
    const timers = Array.from({ length: n }, (_, k) =>
      setTimeout(() => setRevealed(k + 1), REVEAL_START_MS + k * REVEAL_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [n]);

  useEffect(() => {
    if (revealed === n && n > 0) {
      const fire = (ratio: number, opts: confetti.Options) =>
        confetti({ origin: { y: 0.4 }, particleCount: Math.floor(200 * ratio), ...opts });
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }
  }, [revealed, n]);

  useEffect(() => {
    if (n === 0) return;
    const addrs = scores.map((s) => s.address.toLowerCase());
    fetchPlayerNames(addrs).then(setNames).catch(() => {});
  }, [n, scores]);

  const handleShare = () => {
    const me = scores.find((p) => p.address.toLowerCase() === myAddress?.toLowerCase());
    const rank = me ? scores.indexOf(me) + 1 : 0;
    const text = me
      ? `I hit ${me.accuracy.toFixed(1)}% (#${rank}) in ${me.timeSec?.toFixed(2) ?? "?"}s on Nadient 🎨`
      : `Winner: ${result.winnerAccuracy.toFixed(1)}% on Nadient 🎨`;
    navigator.clipboard?.writeText(text).then(
      () => { setShareFeedback("Copied!"); setTimeout(() => setShareFeedback(null), 1500); },
      () => setShareFeedback("Failed"),
    );
  };

  return (
    <div className="max-w-2xl mx-auto page-enter flex flex-col items-center">
      <div className="w-full max-w-md bg-main/15 rounded-[2rem] p-8">
        <h2 className="text-xl font-heading text-foreground text-center mb-8 animate-in fade-in slide-in-from-top-2 duration-500 fill-mode-both">
          Match Result:
        </h2>
        <div className="flex flex-col gap-3 mb-8 w-full">
          {scores.map((player, i) => {
            const isWinnerP = player.address.toLowerCase() === result.winner?.toLowerCase();
            const isMe = player.address.toLowerCase() === myAddress?.toLowerCase();
            const tone = addrTone(player.address);
            const stepNeeded = n - i;
            const isVisible = revealed >= stepNeeded;
            const nameOrFallback = names[player.address.toLowerCase()] ?? null;
            return (
              <div
                key={player.address}
                className={`relative flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-border shadow-shadow transition-all duration-500 ${toneBg(tone)} ${
                  isWinnerP ? "ring-2 ring-chart-1/40" : ""
                } ${isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-heading text-lg w-6 text-foreground/80">#{i + 1}</span>
                  <div
                    className={`w-9 h-9 rounded-full border-2 border-border flex items-center justify-center font-heading text-xs text-main-foreground shrink-0 ${toneRing(tone)}`}
                  >
                    {addrInitials(player.address)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-heading text-sm text-foreground truncate">
                        {nameOrFallback ?? addrInitials(player.address) + "..."}
                      </span>
                      {isMe && (
                        <Badge className="bg-foreground text-background text-[10px] px-1.5 py-0 h-4">You</Badge>
                      )}
                      {isWinnerP && (
                        <Crown className="w-3.5 h-3.5 text-chart-3 shrink-0" fill="currentColor" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-foreground/50">
                      {typeof player.timeSec === "number" ? `${player.timeSec.toFixed(2)}s` : "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-heading text-lg text-foreground">
                    {player.accuracy.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div
          className={`flex justify-center gap-3 transition-all duration-500 ${
            revealed === n ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <Button onClick={onAgain} className="gap-2 rounded-xl px-6 font-heading min-w-[140px]" size="lg">
            <RotateCcw className="w-4 h-4" /> Play Again
          </Button>
          <Button
            variant="neutral"
            onClick={handleShare}
            className="gap-2 rounded-xl px-6 font-heading min-w-[140px] bg-secondary-background"
            size="lg"
          >
            {shareFeedback ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {shareFeedback ?? "Share"}
          </Button>
        </div>
      </div>
    </div>
  );
}
