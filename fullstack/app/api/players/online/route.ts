import { NextResponse } from "next/server";
import { redis } from "@/lib/db/redis";

const ONLINE_KEY = "online:players";
const TTL_MS = 60_000; // player considered online if heartbeat < 60s ago

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("walletAddress");

  const now = Date.now();
  const cutoff = now - TTL_MS;

  // Register player if walletAddress provided
  if (walletAddress) {
    await redis.zadd(ONLINE_KEY, {
      score: now,
      member: walletAddress.toLowerCase(),
    });
  }

  // Remove stale entries
  await redis.zremrangebyscore(ONLINE_KEY, 0, cutoff);

  // Count active players
  const online = await redis.zcard(ONLINE_KEY);

  return NextResponse.json({ online });
}
