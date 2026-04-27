"use client";

import { useCallback, useRef, useState } from "react";
import {
  createRoom as apiCreateRoom,
  joinRoom as apiJoinRoom,
  leaveRoom as apiLeaveRoom,
  cancelRoom as apiCancelRoom,
  kickPlayer as apiKickPlayer,
  setReady as apiSetReady,
  startRoomGame as apiStartRoomGame,
  resetRoom as apiResetRoom,
  pollRoom,
} from "../services/rooms.service";
import type { Room, Mode } from "../types/play.types";
import { USDC_DECIMALS, MODE_NUM } from "../types/play.types";
import type { TargetDifficulty } from "@/src/utils/color";
import { targetFromRoundId } from "@/src/utils/color";

export function useRoomManager(
  address: string | null,
  roundId: string | null,
  doStake: (rid: string, modeEnum: number, amount: bigint) => Promise<void>,
  onRoomActive: (room: Room) => void,
  onRoomGone: (msg?: string) => void,
) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [readying, setReadying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (code: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        if (!address) return;
        try {
          const res = await pollRoom(code, address);
          if (!res.room) {
            stopPolling();
            setRoom(null);
            onRoomGone(
              res.error === "Room not found"
                ? "Room closed or expired"
                : undefined,
            );
            return;
          }
          const r = res.room;
          setRoom(r);
          if (r.status === "active" && r.roundId && r.roundId !== roundId) {
            stopPolling();
            onRoomActive(r);
          }
          if (r.status === "cancelled") {
            stopPolling();
            setRoom(null);
            onRoomGone("Room cancelled");
          }
        } catch {}
      }, 2000);
    },
    [address, roundId, stopPolling, onRoomActive, onRoomGone],
  );

  const create = useCallback(
    async (input: {
      name: string;
      maxPlayers: number;
      paid: boolean;
      stakeAmount: number;
      difficulty: TargetDifficulty;
    }): Promise<string | null> => {
      if (!address) return null;
      setError(null);
      setLoading("Creating room...");
      try {
        let res = await apiCreateRoom(address, input);
        if (res.error === "You are still in another room" && res.code) {
          setLoading("Leaving previous room...");
          await apiLeaveRoom(address, res.code);
          setLoading("Creating a new room...");
          res = await apiCreateRoom(address, input);
        }
        if (res.error) { setError(res.error); return null; }
        return res.room?.code ?? null;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to create room");
        return null;
      } finally {
        setLoading(null);
      }
    },
    [address],
  );

  const join = useCallback(
    async (code: string): Promise<Room | null> => {
      if (!address) return null;
      setError(null);
      setLoading("Joining room...");
      try {
        const res = await apiJoinRoom(address, code);
        if (res.error) { setError(res.error); return null; }
        return res.room ?? null;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to join room");
        return null;
      } finally {
        setLoading(null);
      }
    },
    [address],
  );

  const leave = useCallback(
    async (code: string): Promise<boolean> => {
      stopPolling();
      if (address) {
        try {
          await apiLeaveRoom(address, code);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Failed to leave room");
          return false;
        }
      }
      setRoom(null);
      return true;
    },
    [address, stopPolling],
  );

  const cancel = useCallback(
    async (code: string): Promise<boolean> => {
      stopPolling();
      if (address) {
        try {
          await apiCancelRoom(address, code);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Failed to cancel room");
          return false;
        }
      }
      setRoom(null);
      return true;
    },
    [address, stopPolling],
  );

  const kick = useCallback(
    async (code: string, target: string): Promise<boolean> => {
      if (!address) return false;
      try {
        const res = await apiKickPlayer(address, code, target);
        if (res.cancelled) {
          stopPolling();
          setRoom(null);
          setError("Room was cancelled because a player had already staked");
          onRoomGone();
          return false;
        } else if (res.room) {
          setRoom(res.room);
          return true;
        } else if (res.error) {
          setError(res.error);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to kick player");
      }
      return false;
    },
    [address, stopPolling, onRoomGone],
  );

  const toggleReady = useCallback(
    async (currentRoom: Room): Promise<boolean> => {
      if (!address) return false;
      setError(null);
      const me = currentRoom.players.find(
        (p) => p.address.toLowerCase() === address.toLowerCase(),
      );
      if (!me) return false;

      if (!currentRoom.paid) {
        try {
          const res = await apiSetReady(address, currentRoom.code, me.status !== "ready");
          if (res.room) {
            setRoom(res.room);
            return true;
          } else if (res.error) {
            setError(res.error);
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Failed to update ready status");
        }
        return false;
      }

      if (me.staked) {
        try {
          const res = await apiSetReady(address, currentRoom.code);
          if (res.room) {
            setRoom(res.room);
            return true;
          }
        } catch {}
        return false;
      }

      setReadying(true);
      try {
        const amount = BigInt(currentRoom.stakeAmount) * USDC_DECIMALS;
        await doStake(currentRoom.roundId, currentRoom.mode, amount);
        let flipped = false;
        for (let i = 0; i < 10 && !flipped; i++) {
          const res = await apiSetReady(address, currentRoom.code);
          if (res.room) { setRoom(res.room); flipped = true; break; }
          await new Promise((r) => setTimeout(r, 1500));
        }
        if (!flipped) {
          setError("Stake was submitted, but the backend is still syncing. Please wait a moment.");
          return false;
        }
        return true;
      } catch (err: unknown) {
        const e = err as { shortMessage?: string; message?: string };
        setError(e?.shortMessage || e?.message || "Stake failed");
        return false;
      } finally {
        setReadying(false);
      }
    },
    [address, doStake],
  );

  const startGame = useCallback(
    async (code: string): Promise<boolean> => {
      if (!address) return false;
      setError(null);
      try {
        const res = await apiStartRoomGame(address, code);
        if (res.error) {
          setError(res.error);
        } else if (res.room) {
          setRoom(res.room);
          return true;
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to start");
      }
      return false;
    },
    [address],
  );

  const resetGame = useCallback(
    async (code: string) => {
      if (!address) return null;
      try {
        const res = await apiResetRoom(address, code);
        if (res.error) { setError(res.error); return null; }
        if (res.room) setRoom(res.room);
        return res.room ?? null;
      } catch { return null; }
    },
    [address],
  );

  return {
    room,
    setRoom,
    error,
    setError,
    loading,
    readying,
    create,
    join,
    leave,
    cancel,
    kick,
    toggleReady,
    startGame,
    resetGame,
    startPolling,
    stopPolling,
  };
}
