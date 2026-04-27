import type { Room } from "../types/play.types";
import type { TargetDifficulty } from "@/src/utils/color";

type RoomResponse = { room?: Room; error?: string; code?: string; cancelled?: boolean };

export async function createRoom(
  walletAddress: string,
  input: {
    name: string;
    maxPlayers: number;
    paid: boolean;
    stakeAmount: number;
    difficulty: TargetDifficulty;
  },
): Promise<RoomResponse> {
  const res = await fetch("/api/rooms/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, ...input }),
  });
  return res.json();
}

export async function joinRoom(
  walletAddress: string,
  code: string,
): Promise<RoomResponse> {
  const res = await fetch("/api/rooms/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code }),
  });
  return res.json();
}

export async function leaveRoom(
  walletAddress: string,
  code: string,
): Promise<void> {
  await fetch("/api/rooms/leave", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code }),
  });
}

export async function cancelRoom(
  walletAddress: string,
  code: string,
): Promise<void> {
  await fetch("/api/rooms/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code }),
  });
}

export async function kickPlayer(
  walletAddress: string,
  code: string,
  target: string,
): Promise<RoomResponse> {
  const res = await fetch("/api/rooms/kick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code, target }),
  });
  return res.json();
}

export async function setReady(
  walletAddress: string,
  code: string,
  ready?: boolean,
): Promise<RoomResponse> {
  const res = await fetch("/api/rooms/ready", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code, ready }),
  });
  return res.json();
}

export async function startRoomGame(
  walletAddress: string,
  code: string,
): Promise<RoomResponse> {
  const res = await fetch("/api/rooms/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code }),
  });
  return res.json();
}

export async function resetRoom(
  walletAddress: string,
  code: string,
): Promise<RoomResponse> {
  const res = await fetch("/api/rooms/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, code }),
  });
  return res.json();
}

export async function pollRoom(
  code: string,
  walletAddress: string,
): Promise<{ room?: Room; error?: string }> {
  const res = await fetch(`/api/rooms/${code}?walletAddress=${walletAddress}`);
  return res.json();
}

export async function fetchPlayerNames(
  addresses: string[],
): Promise<Record<string, string | null>> {
  const res = await fetch(
    `/api/players/names?addresses=${addresses.join(",")}`,
  );
  const data = await res.json();
  return data.names ?? {};
}
