import { NextResponse } from "next/server";

export async function GET() {
  // TODO: wire to on-chain jackpot contract
  return NextResponse.json({
    jackpot: 12480,
    reservePool: 4827,
    playersOnline: 127,
    tvl: 248000,
    apy: 5.2,
    drawsIn: "2d 4h",
  });
}
