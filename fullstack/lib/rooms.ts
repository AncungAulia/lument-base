import { redis, parseRedisJson } from "./db/redis";
import { randomBytes } from "crypto";

export type RoomStatus = "lobby" | "active" | "resolved" | "cancelled";
export type PlayerStatus = "unready" | "ready";
export type RoomDifficulty = "easy" | "medium" | "hard" | "god";

export type RoomPlayer = {
  address: string;
  status: PlayerStatus;
  staked: boolean;
  joinedAt: number;
};

export type Room = {
  code: string;
  name: string;
  leader: string;
  maxPlayers: number;          // 2..5
  paid: boolean;
  stakeAmount: number;         // USDC units (5/10/15/20), 0 if casual
  difficulty: RoomDifficulty;
  mode: 0 | 1 | 2;             // 1 DUEL (2p), 2 ROYALE (3-5p)
  status: RoomStatus;
  roundId: string;             // bytes32 hex; pre-generated for paid
  players: RoomPlayer[];
  createdAt: number;
  lastActivity: number;
};

export const ROOM_TTL_SECONDS = 10 * 60;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(len = 6): string {
  let out = "";
  const buf = randomBytes(len);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return out;
}

export function generateRoundId(): string {
  return "0x" + randomBytes(32).toString("hex");
}

export function roomKey(code: string) {
  return `room:${code.toUpperCase()}`;
}

export function playerRoomKey(address: string) {
  return `room:player:${address.toLowerCase()}`;
}

export async function getRoom(code: string): Promise<Room | null> {
  return parseRedisJson<Room>(await redis.get(roomKey(code)));
}

export async function saveRoom(room: Room, touch = true): Promise<void> {
  if (touch) room.lastActivity = Date.now();
  await redis.set(roomKey(room.code), JSON.stringify(room), { ex: ROOM_TTL_SECONDS });
}

export async function deleteRoom(room: Room): Promise<void> {
  const pipe = redis.pipeline();
  pipe.del(roomKey(room.code));
  for (const p of room.players) pipe.del(playerRoomKey(p.address));
  await pipe.exec();
}

export async function bindPlayerToRoom(address: string, code: string) {
  await redis.set(playerRoomKey(address), code.toUpperCase(), { ex: ROOM_TTL_SECONDS });
}

export async function touchRoomHeartbeat(code: string, address: string) {
  const pipe = redis.pipeline();
  pipe.expire(roomKey(code), ROOM_TTL_SECONDS);
  pipe.expire(playerRoomKey(address), ROOM_TTL_SECONDS);
  await pipe.exec();
}

export async function unbindPlayer(address: string) {
  await redis.del(playerRoomKey(address));
}

export async function getPlayerRoomCode(address: string): Promise<string | null> {
  const v = await redis.get(playerRoomKey(address));
  return v ? String(v).toUpperCase() : null;
}

export function modeForPlayerCount(max: number): 0 | 1 | 2 {
  if (max === 2) return 1;
  return 2;
}

export function sanitizeRoomName(name: string): string {
  return String(name ?? "").trim().slice(0, 32);
}

export function isLeader(room: Room, address: string): boolean {
  return room.leader.toLowerCase() === address.toLowerCase();
}

export function findPlayer(room: Room, address: string): RoomPlayer | undefined {
  const a = address.toLowerCase();
  return room.players.find((p) => p.address.toLowerCase() === a);
}
