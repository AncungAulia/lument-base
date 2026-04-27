"use client";

import type { ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UsdcIcon from "@/src/components/elements/UsdcIcon";
import type { StakingStep } from "../hooks/useStake";

function StepItem({
  num,
  label,
  desc,
  state,
}: {
  num: number;
  label: ReactNode;
  desc: ReactNode;
  state: "done" | "active" | "pending";
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-base border-2 transition-all duration-300 ${
        state === "done"
          ? "border-chart-2 bg-chart-2/10"
          : state === "active"
            ? "border-chart-1 bg-chart-1/10 shadow-shadow"
            : "border-border bg-secondary-background opacity-40"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          state === "done"
            ? "bg-chart-2 border-chart-2 text-white"
            : state === "active"
              ? "bg-chart-1 border-chart-1 text-white"
              : "bg-secondary-background border-border text-foreground/40"
        }`}
      >
        {state === "done" ? (
          <Check className="w-4 h-4" />
        ) : state === "active" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span className="text-xs font-heading">{num}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-heading text-sm ${state === "done" ? "line-through text-foreground/40" : "text-foreground"}`}>
          {label}
        </p>
        <p className="text-xs text-foreground/50 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function StakingScene({
  needsApproval,
  step,
}: {
  needsApproval: boolean;
  step: StakingStep;
}) {
  const steps = needsApproval
    ? [
        {
          label: (
            <span className="inline-flex items-center gap-2">
              Approve 1 Miliar <UsdcIcon size={14} />
            </span>
          ),
          desc: "One-time approval — you will not need to approve again",
          state: step === "deposit" ? "done" : "active",
        },
        {
          label: "Deposit Stake",
          desc: (
            <span className="inline-flex items-center gap-1">
              <UsdcIcon size={12} /> is locked in the smart contract until the round ends
            </span>
          ),
          state: step === "deposit" ? "active" : "pending",
        },
      ]
    : [
        {
          label: "Deposit Stake",
          desc: (
            <span className="inline-flex items-center gap-1">
              <UsdcIcon size={12} /> is locked in the smart contract until the round ends
            </span>
          ),
          state: "active",
        },
      ];

  return (
    <div className="max-w-2xl mx-auto page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading text-foreground">Locking Stake</h1>
          <p className="text-foreground/60 text-sm">
            Confirm your transaction, then wait for all matched players to lock stake
          </p>
        </div>
        <Badge className="bg-chart-1 text-white animate-pulse">SIGNING</Badge>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <StepItem
                key={i}
                num={i + 1}
                label={s.label}
                desc={s.desc}
                state={s.state as "done" | "active" | "pending"}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-foreground/40">
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
            <span>Waiting for wallet confirmation...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
