import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount) || 0;
  // TODO: call vault contract withdraw
  return NextResponse.json({
    ok: true,
    action: "withdraw",
    amount,
    txHash: "0x" + Math.random().toString(16).slice(2, 10),
  });
}
