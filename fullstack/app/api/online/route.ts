import { NextResponse } from "next/server";
import { redis } from "@/lib/db/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { walletAddress } = body;
    const now = Date.now();

    // Buang user yang gak ngirim ping selama 30 detik (30000 ms)
    await redis.zremrangebyscore("online_users", 0, now - 30000);

    // Kalo ada identifier, update waktu terakhir dia aktif
    if (walletAddress) {
      await redis.zadd("online_users", { score: now, member: walletAddress });
    }

    // Hitung ada berapa orang unik yang online
    const count = await redis.zcard("online_users");

    // Default 1 biar gak 0 kalo sendirian
    return NextResponse.json({ count: Math.max(1, count) });
  } catch (error) {
    return NextResponse.json({ count: 1 });
  }
}
