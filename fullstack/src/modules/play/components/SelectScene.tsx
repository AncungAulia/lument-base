"use client";

import { useState } from "react";
import {
  ArrowRight,
  Crown,
  DollarSign,
  Gamepad2,
  Globe,
  Loader2,
  Play,
  Swords,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { formatCompactUsdc } from "@/src/utils/utils";
import type { Mode, TabKey } from "../types/play.types";
import type { TargetDifficulty } from "@/src/utils/color";

export default function SelectScene({
  tab,
  setTab,
  onStart,
  onCreateRoom,
  onJoinRoom,
  onJoinOnline,
  onlineCount,
  soloReserveBalance,
  roomLoading,
  actionLoading,
  actionLabel,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  onStart: (m: Mode, opts?: { practice?: boolean; difficulty?: TargetDifficulty }) => void;
  onCreateRoom: (input: { name: string; maxPlayers: number; paid: boolean; stakeAmount: number; difficulty: TargetDifficulty }) => void;
  onJoinRoom: (code: string) => void;
  onJoinOnline: (mode: "duel" | "royale") => void;
  onlineCount: number | null;
  soloReserveBalance: number;
  roomLoading?: string | null;
  actionLoading?: boolean;
  actionLabel?: string | null;
}) {
  const [showSoloInfo, setShowSoloInfo] = useState(false);
  const [friendModal, setFriendModal] = useState<"closed" | "choose" | "create" | "join">("closed");
  const [onlineModal, setOnlineModal] = useState<"closed" | "choose">("closed");
  const [roomName, setRoomName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [isPaid, setIsPaid] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(5);
  const [joinCode, setJoinCode] = useState("");

  const resetFriendModal = () => {
    setFriendModal("closed");
    setRoomName("");
    setMaxPlayers(2);
    setIsPaid(false);
    setStakeAmount(5);
    setJoinCode("");
  };
  const locked = !!roomLoading || !!actionLoading;
  const lockedCardClass = locked
    ? "cursor-not-allowed opacity-60"
    : "cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none";

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-foreground">Play</h1>
          <p className="flex items-center gap-1 text-foreground/60 text-sm">Pick a mode · trust your eyes</p>
        </div>
        <Badge className="bg-chart-2 text-main-foreground gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse inline-block" />
          {onlineCount !== null ? `${onlineCount} online` : "READY"}
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single" className="gap-1.5">
            <Gamepad2 className="w-4 h-4" /> Singleplayer
          </TabsTrigger>
          <TabsTrigger value="multi" className="gap-1.5">
            <Users className="w-4 h-4" /> Multiplayer
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "single" ? (
        <div className="flex flex-col gap-4">
          <Card
            aria-disabled={locked}
            className={`group transition-all ${lockedCardClass}`}
            onClick={() => {
              if (locked) return;
              onStart("solo", { practice: true });
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="w-5 h-5 text-chart-2" /> Practice Mode
                </CardTitle>
                <Badge className="bg-chart-2 text-white">FREE</Badge>
              </div>
              <CardDescription>No cost · no time limit · perfect for warming up</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge>Unlimited</Badge>
                  <Badge>No Timer</Badge>
                </div>
                <div className="text-sm font-heading flex items-center gap-1 px-4 py-1.5 rounded-full bg-secondary-background border-2 border-border text-foreground transition-all duration-300 group-hover:bg-chart-2 group-hover:text-white">
                  Start <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            aria-disabled={locked}
            className={`group transition-all ${lockedCardClass}`}
            onClick={() => {
              if (locked) return;
              onStart("solo");
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Swords className="w-5 h-5 text-chart-3" /> Solo Mode
                </CardTitle>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSoloInfo(!showSoloInfo); }}
                    className="w-7 h-7 rounded-full bg-secondary-background border-2 border-border flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-chart-5/20 transition-all cursor-pointer"
                  >
                    <span className="text-xs font-heading">i</span>
                  </button>
                  <Badge className="bg-chart-3 text-main-foreground">
                    <span className="inline-flex items-center gap-1">5 USDC</span>
                  </Badge>
                </div>
              </div>
              <CardDescription>Play vs memory · up to 2.0x payout</CardDescription>
            </CardHeader>

            {showSoloInfo && (
              <div
                className="mx-4 mb-2 p-4 rounded-base border-2 border-border bg-secondary-background animate-in fade-in slide-in-from-top-2 duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs font-heading text-foreground/70 mb-3 uppercase tracking-wider">Payout per Accuracy</p>
                <div className="flex flex-col gap-2">
                  {[
                    { tier: "JACKPOT", acc: "≥ 98%", reward: "10.0 USDC", color: "bg-chart-1" },
                    { tier: "GREAT",   acc: "≥ 90%", reward: "7.5 USDC",  color: "bg-chart-2" },
                    { tier: "GOOD",    acc: "≥ 75%", reward: "6.0 USDC",  color: "bg-chart-3" },
                    { tier: "MISS",    acc: "< 75%", reward: "0 USDC",    color: "bg-chart-4" },
                  ].map((entry) => (
                    <div key={entry.tier} className="flex items-center justify-between py-1.5 px-3 rounded-base border border-border/50">
                      <div className="flex items-center gap-2">
                        <Badge className={`${entry.color} text-black text-xs`}>{entry.tier}</Badge>
                        <span className="text-xs text-foreground/60">{entry.acc}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-heading text-sm text-foreground">
                        {entry.reward.replace(" USDC", "")} USDC
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-chart-1 text-foreground border-border gap-1.5">
                    Pool <strong>{formatCompactUsdc(soloReserveBalance)}</strong> USDC
                  </Badge>
                </div>
                <div className="text-sm font-heading flex items-center gap-1 px-4 py-1.5 rounded-full bg-secondary-background border-2 border-border text-foreground transition-all duration-300 group-hover:bg-main group-hover:text-main-foreground">
                  Start <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card
            aria-disabled={locked}
            className={`group transition-all ${lockedCardClass}`}
            onClick={() => {
              if (locked) return;
              setFriendModal("choose");
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-chart-1" /> Play with Friends
                </CardTitle>
                <Badge className="bg-chart-1 text-white">2-5 Players</Badge>
              </div>
              <CardDescription>Create or join a private room · invite by code</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2"><Badge>Private Room</Badge><Badge>15s</Badge></div>
                <div className="text-sm font-heading flex items-center gap-1 px-4 py-1.5 rounded-full bg-secondary-background border-2 border-border text-foreground transition-all duration-300 group-hover:bg-chart-1 hover:text-white">
                  Start <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            aria-disabled={locked}
            className={`group transition-all ${lockedCardClass}`}
            onClick={() => {
              if (locked) return;
              setOnlineModal("choose");
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="w-5 h-5 text-chart-2" /> Play with Random
                </CardTitle>
                <Badge className="bg-chart-2 text-white">LIVE</Badge>
              </div>
              <CardDescription>Match with random players worldwide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2"><Badge>Ranked</Badge><Badge>15s</Badge><Badge>Auto Match</Badge></div>
                <div className="text-sm font-heading flex items-center gap-1 px-4 py-1.5 rounded-full bg-secondary-background border-2 border-border text-foreground transition-all duration-300 group-hover:bg-chart-2 group-hover:text-white">
                  Start <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Friend Room Modal */}
      {friendModal !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => { if (!roomLoading) resetFriendModal(); }}
        >
          <div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <button onClick={resetFriendModal} disabled={!!roomLoading} className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-secondary-background border-2 border-border flex items-center justify-center text-foreground/60 hover:text-foreground transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-chart-1" /> Play with Friends</CardTitle>
                <CardDescription>
                  {friendModal === "choose" && "Create a new room or join an existing one"}
                  {friendModal === "create" && "Set up your private room"}
                  {friendModal === "join"   && "Enter the room code to join"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {friendModal === "choose" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button disabled={locked} onClick={() => setFriendModal("create")} className="p-5 rounded-base border-2 border-border bg-secondary-background hover:border-chart-1 hover:bg-chart-1/10 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-chart-1/20 border-2 border-chart-1/30 flex items-center justify-center"><Crown className="w-6 h-6 text-chart-1" /></div>
                      <div><span className="font-heading text-sm block">Create Room</span><span className="text-xs text-foreground/50">You become the leader</span></div>
                    </button>
                    <button disabled={locked} onClick={() => setFriendModal("join")} className="p-5 rounded-base border-2 border-border bg-secondary-background hover:border-chart-2 hover:bg-chart-2/10 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-chart-2/20 border-2 border-chart-2/30 flex items-center justify-center"><Users className="w-6 h-6 text-chart-2" /></div>
                      <div><span className="font-heading text-sm block">Join Room</span><span className="text-xs text-foreground/50">Enter a room code</span></div>
                    </button>
                  </div>
                )}

                {friendModal === "create" && (
                  <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-heading uppercase tracking-wider text-foreground/60">Room Name</Label>
                      <Input placeholder="My Room" value={roomName} onChange={(e) => setRoomName(e.target.value.slice(0, 32))} disabled={!!roomLoading} className="font-heading" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-heading uppercase tracking-wider text-foreground/60">Max Players</Label>
                      <div className="flex gap-2">
                        {[2, 3, 4, 5].map((n) => (
                          <button key={n} disabled={!!roomLoading} onClick={() => setMaxPlayers(n)}
                            className={`flex-1 py-2.5 rounded-base border-2 font-heading text-sm transition-all cursor-pointer ${maxPlayers === n ? "border-chart-1 bg-chart-1/10 text-chart-1" : "border-border bg-secondary-background text-foreground/60 hover:border-chart-1/50"}`}
                          >{n}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-base border-2 border-border bg-secondary-background">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-chart-2" />
                        <div>
                          <p className="font-heading text-sm">Stake Mode</p>
                          <p className="text-xs text-foreground/50">Players bet USDC to play</p>
                        </div>
                      </div>
                      <Switch checked={isPaid} onCheckedChange={setIsPaid} disabled={!!roomLoading} />
                    </div>
                    {isPaid && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <Label className="text-xs font-heading uppercase tracking-wider text-foreground/60">Stake Amount</Label>
                        <div className="flex gap-2">
                          {[5, 10, 15, 20].map((amt) => (
                            <button key={amt} disabled={!!roomLoading} onClick={() => setStakeAmount(amt)}
                              className={`flex-1 py-2.5 rounded-base border-2 font-heading text-sm transition-all cursor-pointer ${stakeAmount === amt ? "border-chart-2 bg-chart-2/10 text-chart-2" : "border-border bg-secondary-background text-foreground/60 hover:border-chart-2/50"}`}
                            >{amt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button className="w-full gap-2 bg-chart-1 text-white border-chart-1" size="lg" disabled={!roomName.trim() || locked}
                      onClick={() => onCreateRoom({ name: roomName.trim(), maxPlayers, paid: isPaid, stakeAmount: isPaid ? stakeAmount : 0, difficulty: "medium" })}
                    >
                      <Crown className="w-4 h-4" /> Create Room
                    </Button>
                  </div>
                )}

                {friendModal === "join" && (
                  <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-heading uppercase tracking-wider text-foreground/60">Room Code</Label>
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                        placeholder="ENTER CODE"
                        disabled={!!roomLoading}
                        className="w-full px-4 py-4 rounded-base border-2 border-border bg-secondary-background text-center text-3xl font-heading tracking-[0.3em] focus:outline-none focus:border-chart-1 transition-colors"
                      />
                    </div>
                    <Button className="w-full gap-2 bg-chart-1 text-white border-chart-1 disabled:opacity-40 disabled:cursor-not-allowed" size="lg" disabled={joinCode.length < 4 || locked} onClick={() => onJoinRoom(joinCode)}>
                      <Users className="w-4 h-4" /> Join Room
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Online Mode Modal */}
      {onlineModal !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setOnlineModal("closed")}>
          <div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOnlineModal("closed")} className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-secondary-background border-2 border-border flex items-center justify-center text-foreground/60 hover:text-foreground transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-chart-2" /> Play Online</CardTitle>
                <CardDescription>Choose the matchmaking mode you want to enter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button disabled={locked} onClick={() => { setOnlineModal("closed"); onJoinOnline("duel"); }} className="p-5 rounded-base border-2 border-border bg-secondary-background hover:border-chart-2 hover:bg-chart-2/10 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-chart-2/20 border-2 border-chart-2/30 flex items-center justify-center"><Swords className="w-6 h-6 text-chart-2" /></div>
                    <div><span className="font-heading text-sm block">1v1 Duel</span><span className="text-xs text-foreground/50 inline-flex items-center gap-1">Quick queue · 10 USDC</span></div>
                  </button>
                  <button disabled={locked} onClick={() => { setOnlineModal("closed"); onJoinOnline("royale"); }} className="p-5 rounded-base border-2 border-border bg-secondary-background hover:border-chart-3 hover:bg-chart-3/10 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-chart-3/20 border-2 border-chart-3/30 flex items-center justify-center"><Crown className="w-6 h-6 text-chart-3" /></div>
                    <div><span className="font-heading text-sm block">Quick Royale</span><span className="text-xs text-foreground/50 inline-flex items-center gap-1">5 players · 10 USDC</span></div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Room loading overlay */}
      {(roomLoading || actionLoading) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative mx-4 w-full max-w-sm overflow-hidden rounded-[28px] border-[3px] border-border bg-background/90 p-7 shadow-[10px_10px_0_0_rgba(15,23,42,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--chart-1),var(--chart-3),var(--chart-5))]" />
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-border bg-chart-1/12">
                <Loader2 className="h-8 w-8 animate-spin text-chart-1" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-heading uppercase tracking-[0.28em] text-foreground/45">Room Progress</p>
                <h3 className="text-2xl font-heading text-foreground">{roomLoading ?? actionLabel ?? "Preparing..."}</h3>
                <p className="text-sm text-foreground/60">Do not close this page while the room is syncing.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
