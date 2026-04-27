import { NextResponse } from "next/server";
import { randomTarget, type TargetDifficulty } from "@/src/utils/color";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode: string = body?.mode ?? "solo";
  const difficulty = (body?.difficulty ?? "medium") as TargetDifficulty;

  const target = randomTarget(difficulty);

  // Generate a proper bytes32 roundId for on-chain use
  const roundId = "0x" + randomBytes(32).toString("hex");

  return NextResponse.json({
    roundId,
    mode,
    difficulty,
    target,
    previewSeconds: 5,
    guessSeconds: 15,
    startedAt: Date.now(),
  });
}
