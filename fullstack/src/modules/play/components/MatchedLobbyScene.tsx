"use client";

import { Check, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addrTone, toneBg, shortAddr, addrInitials } from "@/src/utils/address";
import { REQUIRED_PLAYERS } from "../types/play.types";

export default function MatchedLobbyScene({
  mode,
  players,
  myAddress,
  stakedCount,
  stakedPlayers,
  staking,
  countdown,
  onStake,
  onLeave,
}: {
  mode: "duel" | "royale";
  players: string[];
  myAddress: string;
  stakedCount: number;
  stakedPlayers: string[];
  staking: boolean;
  countdown: number | null;
  onStake: () => void;
  onLeave?: () => void;
}) {
  const required = REQUIRED_PLAYERS[mode];
  const normalizedMe = myAddress.toLowerCase();
  const stakedSet = new Set(stakedPlayers.map((p) => p.toLowerCase()));
  const myStaked = stakedSet.has(normalizedMe);
  const everyoneStaked = stakedCount >= players.length && players.length > 0;

  // Leave is only possible while we are still waiting — once the countdown
  // fires (all staked, game transitioning) or the player is mid-tx, it is
  // disabled to avoid corrupting game state.
  const canLeave = !everyoneStaked && countdown === null && !staking && !!onLeave;

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-foreground">Match Found</h1>
          <p className="text-foreground/60 text-sm">
            {mode === "duel" ? "1 vs 1 Duel" : "5 Player Royale"} ·{" "}
            {Math.min(players.length, required)}/{required} players
          </p>
        </div>
        <Badge className="bg-chart-2 text-white">MATCHED</Badge>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3">
            {players.map((player) => {
              const staked = stakedSet.has(player.toLowerCase());
              const isMe = player.toLowerCase() === normalizedMe;
              const tone = addrTone(player);
              return (
                <div
                  key={player}
                  className="flex items-center justify-between rounded-base border-2 border-border bg-secondary-background px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-border font-heading text-sm ${toneBg(tone)}`}
                    >
                      {addrInitials(player)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-sm text-foreground">
                        {shortAddr(player)} {isMe ? "(You)" : ""}
                      </p>
                      <p className="text-xs text-foreground/50">
                        {staked ? "Stake locked" : "Waiting to stake"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      staked
                        ? "bg-chart-2 text-white"
                        : "bg-secondary-background text-foreground border-border"
                    }
                  >
                    {staked ? "Staked" : "Pending"}
                  </Badge>
                </div>
              );
            })}
          </div>
          <div className="mt-6 mx-2 text-sm text-foreground/60">
            {everyoneStaked ? (
              <span>All players have payed. Match is about to start.</span>
            ) : myStaked ? (
              <span>Waiting for several player(s) to pay</span>
            ) : (
              <span>Pay to ready up</span>
            )}
          </div>
        </CardContent>
      </Card>

      {countdown !== null ? (
        <Card className="mb-4 border-chart-2 bg-chart-2/10">
          <CardContent className="pt-6 text-center">
            <p className="mb-2 text-xs font-heading uppercase tracking-wider text-foreground/50">Starting In</p>
            <p className="text-5xl font-heading text-chart-2">{countdown}</p>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="w-full gap-2"
          size="lg"
          disabled={staking || myStaked}
          onClick={onStake}
        >
          {staking ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Paying...</>
          ) : myStaked ? (
            <><Check className="w-4 h-4" /> Payed</>
          ) : (
            <> Pay 10 USDC</>
          )}
        </Button>
      )}

      {canLeave && (
        <Button
          variant="neutral"
          className="w-full gap-2 mt-2 bg-chart-4! text-white hover:bg-chart-4/90!"
          onClick={onLeave}
        >
          <X className="w-4 h-4" /> Leave Lobby
        </Button>
      )}
    </div>
  );
}
