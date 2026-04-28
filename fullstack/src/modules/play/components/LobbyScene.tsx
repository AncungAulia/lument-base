"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Loader2,
  Play,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { shortAddr } from "@/src/utils/address";
import { fetchPlayerNames } from "../services/rooms.service";
import type { Room } from "../types/play.types";
import { showSuccessToast } from "@/src/utils/toast";

export default function LobbyScene({
  room,
  myAddress,
  readying,
  actionPending,
  onLeave,
  onCancel,
  onKick,
  onToggleReady,
  onStart,
}: {
  room: Room;
  myAddress: string;
  readying: boolean;
  actionPending?: string | null;
  onLeave: () => void;
  onCancel: () => void;
  onKick: (target: string) => void;
  onToggleReady: () => void;
  onStart: () => void;
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [names, setNames] = useState<Record<string, string | null>>({});

  const isMe = (addr: string) => addr.toLowerCase() === myAddress.toLowerCase();
  const amLeader = room.leader.toLowerCase() === myAddress.toLowerCase();
  const me = room.players.find((p) => isMe(p.address));
  const allReady = room.players.every((p) => p.status === "ready");
  const isFull = room.players.length >= room.maxPlayers;
  const canStart = amLeader && allReady && isFull;
  const locked = readying || !!actionPending;

  useEffect(() => {
    if (room.players.length === 0) return;
    const addrs = room.players.map((p) => p.address.toLowerCase());
    fetchPlayerNames(addrs)
      .then(setNames)
      .catch(() => {});
  }, [room.players]);

  const copyLink = () => {
    const url = window.location.origin + "/play/lobby/" + room.code;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedCode(true);
    showSuccessToast("Invite link copied", {
      description: "Share it with friends to bring them into this room.",
      id: "room-link-copied",
    });
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-foreground">{room.name || "Room Lobby"}</h1>
          <p className="text-foreground/60 text-sm">
            {room.players.length}/{room.maxPlayers} players ·{" "}
            {room.paid ? <>{room.stakeAmount} USDC entry</> : "Casual"}
          </p>
        </div>
        <Badge className={room.paid ? "bg-chart-1 text-white" : "bg-chart-2 text-white"}>
          {room.paid ? "STAKED" : "CASUAL"}
        </Badge>
      </div>

      <div className="mb-4 p-4 rounded-base border-2 border-border bg-secondary-background">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-foreground/50 uppercase tracking-wider mb-0.5">Room Code</p>
            <p className="text-2xl font-heading tracking-[0.3em] text-foreground">{room.code}</p>
          </div>
          <Button variant="neutral" size="sm" className="gap-1.5" onClick={copyLink}>
            {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Players
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {room.players.map((player) => {
              const isLeaderPlayer = player.address.toLowerCase() === room.leader.toLowerCase();
              const isSelf = isMe(player.address);
              const displayName = names[player.address.toLowerCase()] ?? shortAddr(player.address);
              return (
                <div
                  key={player.address}
                  className={`flex items-center justify-between p-3 rounded-base border-2 transition-all ${
                    player.status === "ready"
                      ? "border-chart-2 bg-chart-2/5"
                      : "border-border bg-secondary-background"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        player.status === "ready"
                          ? "bg-chart-2/20 border-chart-2 text-chart-2"
                          : "bg-secondary-background border-border text-foreground/30"
                      }`}
                    >
                      {player.status === "ready" ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span className="text-xs">?</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-heading text-sm truncate">{displayName}</span>
                        {isLeaderPlayer && (
                          <Badge className="bg-chart-1/20 text-chart-1 text-xs gap-1">
                            <Crown className="w-3 h-3" /> Leader
                          </Badge>
                        )}
                        {isSelf && (
                          <Badge className="bg-chart-2 text-white text-xs">You</Badge>
                        )}
                      </div>
                      {displayName !== shortAddr(player.address) && (
                        <p className="text-[10px] text-foreground/45 font-mono truncate">
                          {shortAddr(player.address)}
                        </p>
                      )}
                      <span
                        className={`text-xs font-heading ${
                          player.status === "ready" ? "text-chart-2" : "text-foreground/40"
                        }`}
                      >
                        {player.status === "ready" ? "Ready" : "Not Ready"}
                        {room.paid && player.staked && " · Paid"}
                      </span>
                    </div>
                  </div>
                  {amLeader && !isSelf && (
                    <button
                      disabled={locked}
                      onClick={() => onKick(player.address)}
                      className="w-7 h-7 rounded-full border-2 border-border bg-secondary-background text-foreground/40 hover:border-chart-4 hover:text-chart-4 hover:bg-chart-4/10 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 rounded-base border-2 border-dashed border-border/50 bg-secondary-background/50"
              >
                <div className="w-8 h-8 rounded-full border-2 border-border/40 bg-secondary-background flex items-center justify-center text-foreground/20">
                  <span className="text-xs">?</span>
                </div>
                <span className="text-sm text-foreground/30 font-heading">Waiting for player...</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {me && me.status !== "ready" && (
          <Button
            className="w-full gap-2 bg-chart-2 text-white border-chart-2"
            size="lg"
            disabled={locked}
            onClick={onToggleReady}
          >
            {readying ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {room.paid ? "Paying..." : "Readying..."}</>
            ) : (
              <><Check className="w-4 h-4" /> {room.paid ? "Pay & Ready" : "Ready Up"}</>
            )}
          </Button>
        )}
        {me && me.status === "ready" && !amLeader && (
          <div className="text-center py-2">
            <Badge className="bg-chart-2/20 text-chart-2 gap-1.5">
              <Check className="w-3.5 h-3.5" /> You are ready · waiting for leader to start
            </Badge>
          </div>
        )}
        {amLeader && (
          <Button
            className="w-full gap-2 bg-chart-1 text-white border-chart-1 disabled:opacity-40 disabled:cursor-not-allowed"
            size="lg"
            disabled={!canStart || locked}
            onClick={onStart}
          >
            {actionPending === "start" ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Starting...</>
            ) : (
              <>
                <Play className="w-5 h-5" />
                {!isFull
                  ? `Waiting for players (${room.players.length}/${room.maxPlayers})`
                  : !allReady
                    ? "Waiting for all players to ready"
                    : "Start Game"}
              </>
            )}
          </Button>
        )}
        <div className="grid grid-cols-1 gap-2">
          {amLeader ? (
            <Button variant="neutral" className="w-full gap-2" disabled={locked} onClick={onCancel}>
              {actionPending === "cancel" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Canceling...</>
              ) : (
                <><X className="w-4 h-4" /> Cancel Room</>
              )}
            </Button>
          ) : (
            <Button variant="neutral" className="w-full gap-2" disabled={locked} onClick={onLeave}>
              {actionPending === "leave" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Leaving...</>
              ) : (
                <><ArrowLeft className="w-4 h-4" /> Leave Room</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
