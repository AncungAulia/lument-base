"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { useWallet } from "@/src/provider/WalletContext";
import { GAME_ADDRESS, gameAbi } from "@/lib/sc/contracts";
import {
  accuracy,
  tier,
  deltaE,
  randomTarget,
  targetFromRoundId,
} from "@/src/utils/color";
import type { HSL, TargetDifficulty } from "@/src/utils/color";
import { showErrorToast, showSuccessToast } from "@/src/utils/toast";
import { useStake } from "./hooks/useStake";
import { useMatchmaking } from "./hooks/useMatchmaking";
import { useRoomManager } from "./hooks/useRoomManager";
import { useResultPolling } from "./hooks/useResultPolling";
import { useOnlineCount } from "./hooks/useOnlineCount";
import {
  startRound as apiStartRound,
  submitGuess as apiSubmitGuess,
} from "./services/play.service";
import { cancelMatchmaking } from "./services/matchmaking.service";
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

export default function PlayClient({
  initialRoomCode,
}: {
  initialRoomCode?: string;
}) {
  const router = useRouter();
  const { address } = useWallet();

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
  const [initRoomJoined, setInitRoomJoined] = useState(false);

  const guessStartRef = useRef<number>(0);
  const phaseRef = useRef<{ address?: string; mode: Mode; phase: Phase }>({
    mode: "solo",
    phase: "select",
  });
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubmittingRef = useRef(false);
  const lastErrorToastRef = useRef<string | null>(null);

  const { data: soloReserveRaw } = useReadContract({
    address: GAME_ADDRESS,
    abi: gameAbi,
    functionName: "soloReserveBalance",
  });
  const soloReserveBalance = soloReserveRaw ? Number(soloReserveRaw) / 1e6 : 0;
  const onlineCount = useOnlineCount(address);

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
    phaseRef.current = { address: address ?? undefined, mode, phase };
  }, [address, mode, phase]);

  useEffect(() => {
    const handlePageExit = () => {
      if (phaseRef.current.phase === "queueing")
        cleanupOnUnload(phaseRef.current.mode);
    };

    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);
    return () => {
      handlePageExit();
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
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

  useEffect(() => {
    if (phase !== "matched") {
      if (matchedCountdown !== null) setMatchedCountdown(null);
      return;
    }
    if (matchedCountdown === null) return;
    if (matchedCountdown <= 0) {
      setMatchedCountdown(null);
      setPhase("preview");
      return;
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
    if (initialRoomCode && address && !initRoomJoined) {
      setInitRoomJoined(true);
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
  }, [initialRoomCode, address, initRoomJoined, roomManager]);

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
      return;
    }

    if (!address) return;

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
    }
  };

  const submitGuess = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

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
  }, [target, guess, mode, roundId, address, isPractice, startResultPolling]);

  const stakeMatchedRound = useCallback(async () => {
    if (!roundId || mode === "solo") return;

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
  }, [doStake, mode, readStakedPlayers, roundId, roomManager]);

  const acc = accuracy(target, guess);
  const t = tier(acc);
  const dE = deltaE(target, guess);

  if (phase === "select") {
    return (
      <SelectScene
        tab={tab}
        setTab={setTab}
        onStart={startRound}
        onCreateRoom={async (input) => {
          const code = await roomManager.create(input);
          if (!code) return;

          showSuccessToast("Room created", {
            description: `${input.name} is live. Invite your squad with the room code.`,
            id: `room-created:${code}`,
          });
          router.push(`/play/lobby/${code}`);
        }}
        onJoinRoom={async (code) => {
          const room = await roomManager.join(code);
          if (!room) return;

          showSuccessToast("Joined room", {
            description: `You are now in ${room.name || `Room ${room.code}`}.`,
            id: `room-joined:${room.code}`,
          });

          if (!initialRoomCode) {
            router.push(`/play/lobby/${room.code}`);
          } else {
            roomManager.setRoom(room);
            setPhase("lobby");
            roomManager.startPolling(room.code);
          }
        }}
        onJoinOnline={async (queueMode) => {
          const result = await joinQueue(queueMode);
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
      />
    );
  }

  if (phase === "staking") {
    return <StakingScene needsApproval={needsApproval} step={stakingStep} />;
  }

  if (phase === "queueing") {
    return (
      <QueueingScene
        mode={mode as "duel" | "royale"}
        queueCount={queueCount}
        onCancel={async () => {
          await cancelQueue(mode);
          setPhase("select");
        }}
      />
    );
  }

  if (phase === "matched") {
    return (
      <MatchedLobbyScene
        mode={mode as "duel" | "royale"}
        players={matchedPlayers}
        myAddress={address ?? ""}
        stakedCount={matchedStakeCount}
        stakedPlayers={matchedStakedPlayers}
        staking={matchedStakeSubmitting}
        countdown={matchedCountdown}
        onStake={stakeMatchedRound}
      />
    );
  }

  if (phase === "lobby" && roomManager.room) {
    return (
      <LobbyScene
        room={roomManager.room}
        myAddress={address ?? ""}
        readying={roomManager.readying}
        onLeave={async () => {
          const code = roomManager.room!.code;
          const ok = await roomManager.leave(code);
          if (!ok) return;
          showSuccessToast("Left room", {
            description: "You are back at the mode selection screen.",
            id: `room-left:${code}`,
          });
          initialRoomCode ? router.push("/play") : setPhase("select");
        }}
        onCancel={async () => {
          const code = roomManager.room!.code;
          const ok = await roomManager.cancel(code);
          if (!ok) return;
          showSuccessToast("Room cancelled", {
            description: "The lobby has been closed.",
            id: `room-cancelled:${code}`,
          });
          initialRoomCode ? router.push("/play") : setPhase("select");
        }}
        onKick={async (targetAddress) => {
          const ok = await roomManager.kick(
            roomManager.room!.code,
            targetAddress,
          );
          if (!ok) return;
          showSuccessToast("Player removed", {
            description: "The lobby roster has been updated.",
            id: `room-kick:${targetAddress}`,
          });
        }}
        onToggleReady={async () => {
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
          const code = roomManager.room!.code;
          const ok = await roomManager.startGame(code);
          if (!ok) return;
          showSuccessToast("Game starting", {
            description: "Everyone is locked in. Loading the next round.",
            id: `room-start:${code}`,
          });
        }}
      />
    );
  }

  if (phase === "preview") {
    return (
      <PreviewScene
        target={target}
        initialTime={5}
        mode={mode}
        isPractice={isPractice}
        onContinue={() => {
          guessStartRef.current = Date.now();
          setPhase("guess");
        }}
      />
    );
  }

  if (phase === "guess") {
    return (
      <GuessScene
        guess={guess}
        setGuess={setGuess}
        initialTime={15}
        onSubmit={submitGuess}
        isPractice={isPractice}
        target={target}
      />
    );
  }

  if (phase === "waiting") {
    return (
      <WaitingScene
        myAccuracy={acc}
        myTier={t}
        mode={mode}
        target={target}
        guess={guess}
      />
    );
  }

  if (phase === "leaderboard") {
    return (
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
      />
    );
  }

  return (
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
    />
  );
}
