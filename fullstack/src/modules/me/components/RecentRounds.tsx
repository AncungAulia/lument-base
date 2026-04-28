"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { ProfileData } from "../types/profile.types";

function tierCardClass(tierName: string): string {
  switch (tierName) {
    case "JACKPOT": return "bg-chart-1/30 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]";
    case "GREAT":   return "bg-chart-2/30 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]";
    case "GOOD":    return "bg-chart-3/30 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]";
    default:        return "bg-chart-4/30 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.08)]";
  }
}

export default function RecentRounds({
  profile,
  loading,
}: {
  profile: ProfileData;
  loading: boolean;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-heading text-foreground/70 mb-3">RECENT ROUNDS</h2>
      <div className="flex flex-col gap-3">
        {loading && profile.recent_rounds.length === 0 ? (
          <Card className="!py-4">
            <CardContent className="flex items-center gap-2 py-0 text-sm text-foreground/60">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading round history...
            </CardContent>
          </Card>
        ) : profile.recent_rounds.length === 0 ? (
          <Card className="!py-4">
            <CardContent className="py-0 text-sm text-foreground/60">No saved rounds yet.</CardContent>
          </Card>
        ) : (
          profile.recent_rounds.map((round) => (
            <Card key={`${round.round}-${round.playedAt ?? ""}`} className={`!py-3 ${tierCardClass(round.tier)}`}>
              <CardContent className="flex items-center justify-between gap-3 py-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-xs font-base text-foreground/60">#{round.round}</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge className="bg-secondary-background text-foreground border-border">{round.mode}</Badge>
                    {round.isFriends && <Badge className="bg-chart-1 text-white">Friends</Badge>}
                    <span className="text-xs font-heading text-foreground uppercase">{round.tier}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs font-base text-foreground/70">{round.acc.toFixed(1)}%</span>
                  <Badge className={`${round.payout === 0 ? "bg-chart-4" : "bg-chart-2"} text-main-foreground`}>
                    <span className="inline-flex items-center gap-1">+{round.payout.toFixed(1)} USDC</span>
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
