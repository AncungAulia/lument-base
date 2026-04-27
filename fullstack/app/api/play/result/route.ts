import { NextResponse } from "next/server";
import { redis, parseRedisJson } from "@/lib/db/redis";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roundId = searchParams.get("roundId");

  if (!roundId) {
    return NextResponse.json({ error: "Missing roundId" }, { status: 400 });
  }

  const result = parseRedisJson<object>(
    await redis.get(`round:${roundId}:result`),
  );
  if (!result) {
    return NextResponse.json({ resolved: false });
  }

  return NextResponse.json({ resolved: true, ...result });
}
