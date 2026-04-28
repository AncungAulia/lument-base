"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { useWallet } from "@/src/provider/WalletContext";
import { GAME_ADDRESS, gameAbi } from "@/lib/sc/contracts";
import { baseSepolia } from "@/lib/sc/wagmi";
import {
  accuracy,
  tier,
  deltaE,
  randomTarget,
  targetFromRoundId,
} from "@/src/utils/color";
import type { HSL, TargetDifficulty } from "@/src/utils/color";
import { showErrorToast, showSuccessToast } from "@/src/utils/toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useStake } from "./hooks/useStake";
import { useMatchmaking } from "./hooks/useMatchmaking";
import { useRoomManager } from "./hooks/useRoomManager";
import { useResultPolling } from "./hooks/useResultPolling";
import { useOnlineCount } from "./hooks/useOnlineCount";
import {
  startRound as apiStartRound,
  submitGuess as apiSubmitGuess,
} from "./services/play.service";
import {
  cancelMatchmaking,
  leaveMatchedLobby as leaveMatchedLobbyApi,
  leaveMatchedBeacon,
  pollMatchedStatus,
} from "./services/matchmaking.service";
import type {
  Phase,
  Mode,
  TabKey,
  RoundResult,
  Room,
} from "./types/play.types";
import { MODE_NUM, STAKE_AMOUNT } from "./types/play.types";
import SelectScene from "./components/SelectScene";
import StakingScene from "./components/StakingScene";
import QueueingScene from "./components/QueueingScene";
import MatchedLobbyScene from "./components/MatchedLobbyScene";
import LobbyScene from "./components/LobbyScene";
import PreviewScene from "./components/PreviewScene";
import GuessScene from "./components/GuessScene";
import WaitingScene from "./components/WaitingScene";
import LeaderboardScene from "./components/LeaderboardScene";
import ResultScene from "./components/ResultScene";

const PROTECTED_PHASES: Phase[] = [
  "staking",
  "queueing",
  "matched",
  "lobby",
  "preview",
  "guess",
  "waiting",
];

function isProtectedPhase(phase: Phase) {
  return PROTECTED_PHASES.includes(phase);
}

function useProgressiveLabel(active: boolean, labels: string[]) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    const resetId = window.setTimeout(() => setIndex(0), 0);
    const id = setInterval(() => {
      setIndex((current) => Math.min(current + 1, labels.length - 1));
    }, 1800);

    return () => {
      window.clearTimeout(resetId);
      clearInterval(id);
    };
  }, [active, labels.length]);

  return active ? (labels[index] ?? labels[0]) : labels[0];
}

export default function PlayClient({
  initialRoomCode,
}: {
  initialRoomCode?: string;
}) {
  const router = useRouter();
  const { address, connect, isConnected } = useWallet();
  const { isConnected: wagmiConnected } = useAccount();
  const chainId = useChainId();

  const [tab, setTab] = useState<TabKey>(initialRoomCode ? "multi" : "single");
  const [phase, setPhase] = useState<Phase>("select");
  const [mode, setMode] = useState<Mode>("solo");
  const [difficulty, setDifficulty] = useState<TargetDifficulty>("medium");
  const [isPractice, setIsPractice] = useState(false);
  const [target, setTarget] = useState<HSL>({ h: 140, s: 60, l: 55 });
  const [guess, setGuess] = useState<HSL>({ h: 180, s: 50, l: 50 });
  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [matchedPlayers, setMatchedPlayers] = useState<string[]>([]);
  const [matchedStakeCount, setMatchedStakeCount] = useState(0);
  const [matchedStakedPlayers, setMatchedStakedPlayers] = useState<string[]>(
    [],
  );
  const [matchedStakeSubmitting, setMatchedStakeSubmitting] = useState(false);
  const [matchedCountdown, setMatchedCountdown] = useState<number | null>(null);
  const [exitWarningOpen, setExitWarningOpen] = useState(false);
  const [startingRound, setStartingRound] = useState(false);
  const [queueCanceling, setQueueCanceling] = useState(false);
  const [submittingGuess, setSubmittingGuess] = useState(false);
  const [roomActionPending, setRoomActionPending] = useState<string | null>(
    null,
  );

  const guessStartRef = useRef<number>(0);
  const phaseRef = useRef<{
    address?: string;
    mode: Mode;
    phase: Phase;
    roundId: string | null;
  }>({
    mode: "solo",
    phase: "select",
    roundId: null,
  });
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);
  const initRoomJoinedRef = useRef(false);
  const lastErrorToastRef = useRef<string | null>(null);
  const pendingNavigationRef = useRef<string | null>(null);

  const { data: soloReserveRaw } = useReadContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "soloReserveBalance",
  });
  const soloReserveBalance = soloReserveRaw ? Number(soloReserveRaw) / 1e6 : 0;
  const onlineCount = useOnlineCount(address);
  const navigationGuarded = isProtectedPhase(phase);
  const walletReady = !!address && isConnected && wagmiConnected;
  const wrongNetwork = walletReady && chainId !== baseSepolia.id;
  const connectionBlocked =
    phase !== "select" && (!walletReady || wrongNetwork);
  const actionsBlocked = connectionBlocked;
  const startFeedback = useProgressiveLabel(startingRound, [
    "Preparing round...",
    "Signing in Wallet...",
    "Confirming on-chain...",
    "Round ready!",
  ]);
  const matchedStakeFeedback = useProgressiveLabel(matchedStakeSubmitting, [
    "Signing in Wallet...",
    "Confirming on-chain...",
    "Stake locked!",
  ]);
  const submitFeedback = useProgressiveLabel(submittingGuess, [
    "Submitting guess...",
    "Confirming result...",
    "Syncing leaderboard...",
  ]);

  const { doStake, readStakedPlayers, needsApproval, stakingStep } =
    useStake(address);

  const handleRoundResolved = useCallback((result: RoundResult) => {
    setRoundResult(result);
    setPhase("leaderboard");
  }, []);

  const handleRoundError = useCallback((msg: string) => {
    showErrorToast("Round resolution failed", {
      description: msg,
      id: `round-error:${msg}`,
    });
    setPhase("select");
  }, []);

  const { startPolling: startResultPolling, stopPolling: stopResultPolling } =
    useResultPolling(handleRoundResolved, handleRoundError);

  const handleMatched = useCallback(
    (newRoundId: string, players: string[], modeEnum: number) => {
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
      isSubmittingRef.current = false;

      setMode(modeEnum === 2 ? "royale" : "duel");
      setMatchedPlayers(players);
      setMatchedStakeCount(0);
      setMatchedStakedPlayers([]);
      setMatchedStakeSubmitting(false);
      setMatchedCountdown(null);
      setRoundId(newRoundId);
      setRoundResult(null);
      setDifficulty("medium");
      setTarget(targetFromRoundId(newRoundId, "medium"));
      setGuess({ h: 180, s: 50, l: 50 });
      setPhase("matched");
    },
    [],
  );

  const {
    queueCount,
    error: matchmakingError,
    joinQueue,
    cancelQueue,
    cleanupOnUnload,
  } = useMatchmaking(address, handleMatched);

  const handleRoomActive = useCallback((room: Room) => {
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
    isSubmittingRef.current = false;

    const mKey: Mode = room.maxPlayers === 2 ? "duel" : "royale";
    setMode(mKey);
    setDifficulty(room.difficulty ?? "medium");
    setMatchedPlayers(room.players.map((p) => p.address));
    setRoundId(room.roundId);
    setRoundResult(null);
    setTarget(targetFromRoundId(room.roundId, room.difficulty ?? "medium"));
    setGuess({ h: 180, s: 50, l: 50 });
    setIsPractice(false);
    setPhase("preview");
  }, []);

  const handleRoomGone = useCallback((msg?: string) => {
    if (msg) {
      showErrorToast("Room unavailable", {
        description: msg,
        id: `room-gone:${msg}`,
      });
    }
    setPhase("select");
  }, []);

  const { stopPolling: stopRoomPolling, ...roomManager } = useRoomManager(
    address,
    roundId,
    doStake,
    handleRoomActive,
    handleRoomGone,
  );

  useEffect(() => {
    phaseRef.current = { address: address ?? undefined, mode, phase, roundId };
  }, [address, mode, phase, roundId]);

  const guardedPush = useCallback(
    (href: string) => {
      if (isProtectedPhase(phaseRef.current.phase)) {
        pendingNavigationRef.current = href;
        setExitWarningOpen(true);
        return;
      }
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!navigationGuarded) {
      pendingNavigationRef.current = null;
      return;
    }

    window.history.pushState({ lumentGuard: true }, "", window.location.href);

    const handlePopState = () => {
      if (!isProtectedPhase(phaseRef.current.phase)) return;
      window.history.pushState({ lumentGuard: true }, "", window.location.href);
      pendingNavigationRef.current = null;
      setExitWarningOpen(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigationGuarded]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isProtectedPhase(phaseRef.current.phase)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      pendingNavigationRef.current = `${url.pathname}${url.search}${url.hash}`;
      setExitWarningOpen(true);
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    const handlePageExit = () => {
      const { phase, address: addr, mode: m, roundId: rid } = phaseRef.current;
      if (phase === "queueing") cleanupOnUnload(m);
      // Fire-and-forget beacon so the server can refund if stakes exist
      if (phase === "matched" && addr && rid) leaveMatchedBeacon(addr, rid);
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isProtectedPhase(phaseRef.current.phase)) return;
      event.preventDefault();
      event.returnValue = "";
      handlePageExit();
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      handlePageExit();
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [cleanupOnUnload]);

  useEffect(() => {
    if (
      phase !== "matched" ||
      !roundId ||
      matchedPlayers.length === 0 ||
      mode === "solo"
    ) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        const staked = await readStakedPlayers(roundId);
        if (cancelled) return;
        setMatchedStakedPlayers(staked);
        setMatchedStakeCount(staked.length);
        if (
          staked.length >= matchedPlayers.length &&
          matchedCountdown === null
        ) {
          setMatchedCountdown(3);
        }
      } catch {}
    };

    sync();
    const id = setInterval(sync, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    matchedCountdown,
    matchedPlayers,
    mode,
    phase,
    readStakedPlayers,
    roundId,
  ]);

  // Poll matched-status so we detect when the opponent leaves after staking.
  // Equivalent to a "player_left_staked" socket push in this HTTP-polling arch.
  useEffect(() => {
    if (phase !== "matched" || !roundId || !address || mode === "solo") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const status = await pollMatchedStatus(address, roundId);
        if (cancelled || !status.cancelled) return;
        showErrorToast("Opponent left", {
          description: status.refundTx
            ? "Your stake has been refunded."
            : "The match was cancelled.",
          id: "partner-left",
        });
        setMatchedPlayers([]);
        setRoundId(null);
        setPhase("select");
      } catch {}
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [phase, roundId, address, mode]);

  useEffect(() => {
    if (phase !== "matched") {
      if (matchedCountdown !== null) {
        const id = window.setTimeout(() => setMatchedCountdown(null), 0);
        return () => window.clearTimeout(id);
      }
      return;
    }
    if (matchedCountdown === null) return;
    if (matchedCountdown <= 0) {
      const id = window.setTimeout(() => {
        setMatchedCountdown(null);
        setPhase("preview");
      }, 0);
      return () => window.clearTimeout(id);
    }

    const id = setTimeout(() => setMatchedCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(id);
  }, [matchedCountdown, phase]);

  useEffect(() => {
    if (phase === "guess" || phase === "preview") {
      document.body.classList.add("game-active");
    } else {
      document.body.classList.remove("game-active");
    }

    return () => document.body.classList.remove("game-active");
  }, [phase]);

  useEffect(() => {
    if (phase === "guess") return;
    const id = window.setTimeout(() => setSubmittingGuess(false), 0);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (initialRoomCode && address && !initRoomJoinedRef.current) {
      initRoomJoinedRef.current = true;
      roomManager.join(initialRoomCode).then((room) => {
        if (!room) return;

        showSuccessToast("Joined room", {
          description: `You are now in ${room.name || `Room ${room.code}`}.`,
          id: `room-joined:${room.code}`,
        });
        roomManager.setRoom(room);
        setPhase("lobby");
        roomManager.startPolling(room.code);
      });
    }
  }, [initialRoomCode, address, roomManager]);

  useEffect(
    () => () => {
      stopResultPolling();
      stopRoomPolling();
    },
    [stopResultPolling, stopRoomPolling],
  );

  const stakeError = matchmakingError ?? roomManager.error;

  useEffect(() => {
    if (!stakeError) {
      lastErrorToastRef.current = null;
      return;
    }
    if (lastErrorToastRef.current === stakeError) return;

    lastErrorToastRef.current = stakeError;
    showErrorToast("Something went wrong", {
      description: stakeError,
      id: `play-error:${stakeError}`,
    });
  }, [stakeError]);

  const startRound = async (
    m: Mode,
    opts?: { practice?: boolean; difficulty?: TargetDifficulty },
  ) => {
    if (startingRound || actionsBlocked) return;
    setStartingRound(true);

    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
    isSubmittingRef.current = false;

    const practice = !!opts?.practice;
    const nextDiff = opts?.difficulty ?? difficulty;
    setMode(m);
    setDifficulty(nextDiff);
    setIsPractice(practice);
    setRoundResult(null);

    if (practice) {
      try {
        const j = await apiStartRound({
          mode: m,
          tab: "practice",
          difficulty: nextDiff,
        });
        setTarget(j.target ?? randomTarget(nextDiff));
        setRoundId(j.roundId);
      } catch {
        setTarget(randomTarget(nextDiff));
      }
      setGuess({ h: 180, s: 50, l: 50 });
      setPhase("preview");
      setStartingRound(false);
      return;
    }

    if (!address) {
      setStartingRound(false);
      return;
    }

    try {
      const j = await apiStartRound({
        mode: m,
        tab: "play",
        difficulty: nextDiff,
      });
      setTarget(j.target ?? randomTarget(nextDiff));
      setRoundId(j.roundId);
      setGuess({ h: 180, s: 50, l: 50 });
      setPhase("staking");
      await doStake(j.roundId, MODE_NUM[m], STAKE_AMOUNT[m]);
      showSuccessToast("Stake locked", {
        description: "Your round is ready. The preview is starting now.",
        id: "solo-stake-locked",
      });
      setPhase("preview");
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      roomManager.setError(
        e?.shortMessage || e?.message || "Transaction failed. Try again.",
      );
      setPhase("select");
    } finally {
      setStartingRound(false);
    }
  };

  const submitGuess = useCallback(async () => {
    if (isSubmittingRef.current || actionsBlocked) return;
    isSubmittingRef.current = true;
    setSubmittingGuess(true);

    const timeSec = guessStartRef.current
      ? (Date.now() - guessStartRef.current) / 1000
      : undefined;

    if (mode !== "solo" && !isPractice) {
      setPhase("waiting");
      if (roundId) startResultPolling(roundId);

      try {
        const res = await apiSubmitGuess({
          target,
          guess,
          mode,
          roundId: roundId ?? undefined,
          playerAddress: address ?? undefined,
          isPractice,
          timeSec,
        });
        if (res.resolved || res.winner) {
          setRoundResult(res as unknown as RoundResult);
          setPhase("leaderboard");
          setSubmittingGuess(false);
          return;
        }
        if (res.onChainError) {
          showErrorToast("On-chain error", {
            description: res.onChainError,
            id: `submit-onchain-error:${res.onChainError}`,
          });
          return;
        }
      } catch (err: unknown) {
        const e = err as { shortMessage?: string; message?: string };
        showErrorToast("Submission failed", {
          description:
            e?.shortMessage ||
            e?.message ||
            "Could not submit your guess. Waiting for result.",
          id: "submit-guess-error",
        });
      }
    } else {
      try {
        await apiSubmitGuess({
          target,
          guess,
          mode,
          roundId: roundId ?? undefined,
          playerAddress: address ?? undefined,
          isPractice,
          timeSec,
        });
      } catch {}
      resultTimeoutRef.current = setTimeout(() => setPhase("result"), 600);
    }
  }, [
    actionsBlocked,
    target,
    guess,
    mode,
    roundId,
    address,
    isPractice,
    startResultPolling,
  ]);

  const stakeMatchedRound = useCallback(async () => {
    if (!roundId || mode === "solo" || matchedStakeSubmitting || actionsBlocked)
      return;

    const modeKey = mode as "duel" | "royale";
    setMatchedStakeSubmitting(true);
    try {
      try {
        await doStake(roundId, MODE_NUM[modeKey], STAKE_AMOUNT[modeKey]);
      } catch (err) {
        const msg = String(
          (err as { shortMessage?: string; message?: string })?.shortMessage ||
            (err as Error)?.message ||
            "",
        );
        if (!msg.includes("AlreadyStaked")) throw err;
      }

      const staked = await readStakedPlayers(roundId);
      setMatchedStakedPlayers(staked);
      setMatchedStakeCount(staked.length);
      showSuccessToast("Stake submitted", {
        description: "Waiting for the rest of the lobby to lock in.",
        id: "matched-stake-submitted",
      });
    } catch (err: unknown) {
      const e = err as { shortMessage?: string; message?: string };
      roomManager.setError(
        e?.shortMessage || e?.message || "Transaction failed.",
      );
    } finally {
      setMatchedStakeSubmitting(false);
    }
  }, [
    actionsBlocked,
    doStake,
    matchedStakeSubmitting,
    mode,
    readStakedPlayers,
    roundId,
    roomManager,
  ]);

  const leaveMatchedLobby = useCallback(async () => {
    if (!address || !roundId || actionsBlocked) return;
    try {
      await leaveMatchedLobbyApi(address, roundId);
    } catch {}
    setMatchedPlayers([]);
    setRoundId(null);
    setPhase("select");
  }, [actionsBlocked, address, roundId]);

  const acc = accuracy(target, guess);
  const t = tier(acc);
  const dE = deltaE(target, guess);
  const renderWithGuards = (scene: ReactNode) => (
    <>
      {scene}
      {connectionBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-base border-2 border-border bg-error p-6 text-center text-error-foreground shadow-[8px_8px_0_0_var(--border)]">
            <p className="mb-2 text-xs font-heading uppercase tracking-[0.28em] opacity-80">
              Pause State
            </p>
            <h2 className="mb-3 text-2xl font-heading">
              Connection Lost or Wrong Network
            </h2>
            <p className="mb-5 text-sm leading-6 opacity-90">
              Please connect to Base Sepolia to continue.
            </p>
            <button
              type="button"
              onClick={connect}
              className="inline-flex h-11 items-center justify-center rounded-base border-2 border-border bg-secondary-background px-5 font-heading text-foreground shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none"
            >
              Reconnect Wallet
            </button>
          </div>
        </div>
      )}
      {exitWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-error">
                  <AlertCircle className="w-5 h-5" />
                  Are you sure you want to leave?
                </CardTitle>
                <CardDescription>
                  Your entry fee will be lost if you leave during an active
                  round!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      pendingNavigationRef.current = null;
                      setExitWarningOpen(false);
                    }}
                    className="h-11 rounded-base border-2 border-border bg-secondary-background px-4 font-heading text-foreground hover:bg-main hover:text-main-foreground transition-all cursor-pointer"
                  >
                    Stay
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const href = pendingNavigationRef.current ?? "/";
                      pendingNavigationRef.current = null;
                      setExitWarningOpen(false);
                      router.push(href);
                    }}
                    className="h-11 rounded-base border-2 border-border bg-error px-4 font-heading text-error-foreground hover:bg-error/90 transition-all cursor-pointer"
                  >
                    Leave
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );

  if (phase === "select") {
    return (
      <SelectScene
        tab={tab}
        setTab={setTab}
        onStart={startRound}
        onCreateRoom={async (input) => {
          if (startingRound || actionsBlocked) return;
          setStartingRound(true);
          const code = await roomManager.create(input).finally(() => {
            setStartingRound(false);
          });
          if (!code) return;

          showSuccessToast("Room created", {
            description: `${input.name} is live. Invite your squad with the room code.`,
            id: `room-created:${code}`,
          });
          guardedPush(`/play/lobby/${code}`);
        }}
        onJoinRoom={async (code) => {
          if (startingRound || actionsBlocked) return;
          setStartingRound(true);
          const room = await roomManager.join(code).finally(() => {
            setStartingRound(false);
          });
          if (!room) return;

          showSuccessToast("Joined room", {
            description: `You are now in ${room.name || `Room ${room.code}`}.`,
            id: `room-joined:${room.code}`,
          });

          if (!initialRoomCode) {
            guardedPush(`/play/lobby/${room.code}`);
          } else {
            roomManager.setRoom(room);
            setPhase("lobby");
            roomManager.startPolling(room.code);
          }
        }}
        onJoinOnline={async (queueMode) => {
          if (startingRound || actionsBlocked) return;
          setStartingRound(true);
          const result = await joinQueue(queueMode).finally(() => {
            setStartingRound(false);
          });
          if (result !== "queued") return;

          showSuccessToast("Queue joined", {
            description:
              "Matchmaking started. We will notify you as soon as a match is found.",
            id: `queue-joined:${queueMode}`,
          });
          setMode(queueMode);
          setPhase("queueing");
        }}
        onlineCount={onlineCount}
        soloReserveBalance={soloReserveBalance}
        roomLoading={roomManager.loading}
        actionLoading={startingRound}
        actionLabel={startFeedback}
      />
    );
  }

  if (phase === "staking") {
    return renderWithGuards(
      <StakingScene needsApproval={needsApproval} step={stakingStep} />,
    );
  }

  if (phase === "queueing") {
    return renderWithGuards(
      <QueueingScene
        mode={mode as "duel" | "royale"}
        queueCount={queueCount}
        canceling={queueCanceling}
        onCancel={async () => {
          if (queueCanceling || actionsBlocked) return;
          setQueueCanceling(true);
          try {
            await cancelQueue(mode);
            setPhase("select");
          } finally {
            setQueueCanceling(false);
          }
        }}
      />,
    );
  }

  if (phase === "matched") {
    return renderWithGuards(
      <MatchedLobbyScene
        mode={mode as "duel" | "royale"}
        players={matchedPlayers}
        myAddress={address ?? ""}
        stakedCount={matchedStakeCount}
        stakedPlayers={matchedStakedPlayers}
        staking={matchedStakeSubmitting}
        stakingLabel={matchedStakeFeedback}
        countdown={matchedCountdown}
        onStake={stakeMatchedRound}
        onLeave={leaveMatchedLobby}
      />,
    );
  }

  if (phase === "lobby" && roomManager.room) {
    return renderWithGuards(
      <LobbyScene
        room={roomManager.room}
        myAddress={address ?? ""}
        readying={roomManager.readying}
        actionPending={roomActionPending}
        onLeave={async () => {
          if (roomActionPending || actionsBlocked) return;
          setRoomActionPending("leave");
          const code = roomManager.room!.code;
          const ok = await roomManager.leave(code).finally(() => {
            setRoomActionPending(null);
          });
          if (!ok) return;
          showSuccessToast("Left room", {
            description: "You are back at the mode selection screen.",
            id: `room-left:${code}`,
          });
          if (initialRoomCode) {
            router.push("/play");
          } else {
            setPhase("select");
          }
        }}
        onCancel={async () => {
          if (roomActionPending || actionsBlocked) return;
          setRoomActionPending("cancel");
          const code = roomManager.room!.code;
          const ok = await roomManager.cancel(code).finally(() => {
            setRoomActionPending(null);
          });
          if (!ok) return;
          showSuccessToast("Room cancelled", {
            description: "The lobby has been closed.",
            id: `room-cancelled:${code}`,
          });
          if (initialRoomCode) {
            router.push("/play");
          } else {
            setPhase("select");
          }
        }}
        onKick={async (targetAddress) => {
          if (roomActionPending || actionsBlocked) return;
          setRoomActionPending("kick");
          const ok = await roomManager
            .kick(roomManager.room!.code, targetAddress)
            .finally(() => {
              setRoomActionPending(null);
            });
          if (!ok) return;
          showSuccessToast("Player removed", {
            description: "The lobby roster has been updated.",
            id: `room-kick:${targetAddress}`,
          });
        }}
        onToggleReady={async () => {
          if (roomActionPending || actionsBlocked) return;
          const code = roomManager.room!.code;
          const paid = roomManager.room!.paid;
          const ok = await roomManager.toggleReady(roomManager.room!);
          if (ok && !paid) {
            showSuccessToast("Ready updated", {
              description: "Your lobby status has been refreshed.",
              id: `room-ready:${code}`,
            });
          }
        }}
        onStart={async () => {
          if (roomActionPending || actionsBlocked) return;
          setRoomActionPending("start");
          const code = roomManager.room!.code;
          const ok = await roomManager.startGame(code).finally(() => {
            setRoomActionPending(null);
          });
          if (!ok) return;
          showSuccessToast("Game starting", {
            description: "Everyone is locked in. Loading the next round.",
            id: `room-start:${code}`,
          });
        }}
      />,
    );
  }

  if (phase === "preview") {
    return renderWithGuards(
      <PreviewScene
        target={target}
        initialTime={5}
        mode={mode}
        isPractice={isPractice}
        paused={connectionBlocked}
        onContinue={() => {
          if (connectionBlocked) return;
          guessStartRef.current = Date.now();
          setPhase("guess");
        }}
      />,
    );
  }

  if (phase === "guess") {
    return renderWithGuards(
      <GuessScene
        guess={guess}
        setGuess={setGuess}
        initialTime={15}
        onSubmit={submitGuess}
        isPractice={isPractice}
        target={target}
        paused={connectionBlocked}
        submitting={submittingGuess}
        submitLabel={submitFeedback}
      />,
    );
  }

  if (phase === "waiting") {
    return renderWithGuards(
      <WaitingScene
        myAccuracy={acc}
        myTier={t}
        mode={mode}
        target={target}
        guess={guess}
        onCancel={() => {
          stopResultPolling();
          isSubmittingRef.current = false;
          setPhase("select");
        }}
      />,
    );
  }

  if (phase === "leaderboard") {
    return renderWithGuards(
      <LeaderboardScene
        result={roundResult!}
        myAddress={address!}
        mode={mode}
        onAgain={async () => {
          if (roomManager.room && address) {
            if (
              roomManager.room.leader.toLowerCase() === address.toLowerCase()
            ) {
              const updated = await roomManager.resetGame(
                roomManager.room.code,
              );
              if (!updated) return;
            }
            setRoundResult(null);
            setPhase("lobby");
            roomManager.startPolling(roomManager.room.code);
            return;
          }

          if (address)
            cancelMatchmaking(address, MODE_NUM[mode]).catch(() => {});
          isSubmittingRef.current = false;
          setMatchedPlayers([]);
          setRoundResult(null);
          setPhase("select");
        }}
      />,
    );
  }

  return renderWithGuards(
    <ResultScene
      target={target}
      guess={guess}
      acc={acc}
      tier={t}
      deltaE={dE}
      isPractice={isPractice}
      mode={mode}
      matchedPlayers={matchedPlayers}
      onAgain={() => {
        isSubmittingRef.current = false;
        setMatchedPlayers([]);
        setPhase("select");
      }}
    />,
  );
}
