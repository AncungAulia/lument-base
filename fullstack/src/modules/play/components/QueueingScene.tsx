"use client";

import { Loader2, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REQUIRED_PLAYERS } from "../types/play.types";

export default function QueueingScene({
  mode,
  queueCount,
  onCancel,
  roomCode,
}: {
  mode: "duel" | "royale";
  queueCount: number;
  onCancel: () => void;
  roomCode?: string | null;
}) {
  const required = REQUIRED_PLAYERS[mode];
  const filled = Math.min(queueCount, required);

  return (
    <div className="max-w-2xl mx-auto page-enter ">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-foreground">
            {roomCode ? "Waiting for Friend" : "Finding Match"}
          </h1>
          <p className="text-foreground/60 text-sm">
            {mode === "duel" ? "1 vs 1 Duel" : "5 Player Royale"} · {filled}/{required} players
          </p>
        </div>
        <Badge className="bg-chart-1 text-white">
          {roomCode ? "FRIEND" : "QUEUED"}
        </Badge>
      </div>

      {roomCode && (
        <div className="mb-4 p-3 rounded-base border-2 border-chart-2 bg-chart-2/10 text-center">
          <p className="text-xs text-foreground/60 uppercase tracking-wider">Room Code</p>
          <p className="text-2xl font-heading tracking-[0.3em] text-foreground">{roomCode}</p>
        </div>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Players
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {/* Filled slots — players already in queue */}
            {Array.from({ length: filled }).map((_, i) => (
              <div
                key={`filled-${i}`}
                className="flex items-center gap-3 p-3 rounded-base border-2 border-chart-2 bg-chart-2/5 animate-in fade-in slide-in-from-top-1 duration-300"
              >
                <div className="w-8 h-8 rounded-full border-2 border-chart-2 bg-chart-2/20 text-chart-2 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-heading text-sm text-foreground">
                    {i === 0 ? "You" : "Player found"}
                  </span>
                  <p className="text-xs text-chart-2 font-heading">In queue</p>
                </div>
                <Badge className="ml-auto bg-chart-2 text-white text-xs">Ready</Badge>
              </div>
            ))}

            {/* Empty slots — waiting for more players */}
            {Array.from({ length: required - filled }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 rounded-base border-2 border-dashed border-border/50 bg-secondary-background/50"
              >
                <div className="w-8 h-8 rounded-full border-2 border-border/40 bg-secondary-background flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 text-foreground/30 animate-spin" />
                </div>
                <span className="text-sm text-foreground/40 font-heading">
                  Waiting for player...
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-sm text-foreground/50">
            Waiting for available players...
          </p>
        </CardContent>
      </Card>

      <Button
        variant="neutral"
        className="w-full gap-2 !bg-chart-4 text-white hover:!bg-chart-4/90"
        onClick={onCancel}
      >
        <X className="w-4 h-4" /> Cancel
      </Button>
    </div>
  );
}
