"use client";

import { useEffect, useRef, useState } from "react";
import { hslCss } from "@/src/utils/color";
import type { HSL } from "@/src/utils/color";
import type { Mode } from "../types/play.types";

export default function PreviewScene({
  target,
  initialTime = 5,
  mode,
  isPractice,
  onContinue,
}: {
  target: HSL;
  initialTime?: number;
  mode: Mode;
  isPractice: boolean;
  onContinue: () => void;
}) {
  const [introState, setIntroState] = useState<"READY" | "SET" | "GO!" | null>("READY");
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const finishedRef = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setIntroState("SET"), 800);
    const t2 = setTimeout(() => setIntroState("GO!"), 1600);
    const t3 = setTimeout(() => setIntroState(null), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (introState !== null) return;
    const duration = initialTime * 1000;
    let startTime: number | null = null;
    let req: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const remaining = Math.max(0, duration - (ts - startTime));
      setTimeLeft(remaining / 1000);
      if (remaining > 0) {
        req = requestAnimationFrame(step);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        setTimeout(onContinue, 600);
      }
    };
    req = requestAnimationFrame(step);
    return () => cancelAnimationFrame(req);
  }, [introState, initialTime, onContinue]);

  return (
    <div className="game-zone max-w-3xl mx-auto page-enter">
      <div
        className="relative w-full rounded-2xl overflow-hidden border-2 border-border shadow-shadow transition-colors duration-1000"
        style={{
          backgroundColor: introState !== null ? "#171717" : hslCss(target),
          aspectRatio: "4/3",
          minHeight: "min(70vh,600px)",
        }}
      >
        <div className="absolute top-6 right-6">
          {introState !== null ? (
            <div className="relative w-24 h-10 flex items-center justify-end px-4 py-2">
              {(["READY", "SET", "GO!"] as const).map((s) => (
                <div
                  key={s}
                  className={`absolute transition-opacity duration-500 font-heading text-xl text-white ${introState === s ? "opacity-100" : "opacity-0"}`}
                >
                  {s}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-full bg-black/20 px-4 py-2 font-heading text-white text-xl animate-in fade-in fill-mode-both duration-1000">
              {timeLeft.toFixed(2)}s
            </div>
          )}
        </div>
        <div
          className="absolute bottom-6 right-6 text-white/30 text-sm font-heading transition-opacity duration-1000"
          style={{ opacity: introState !== null ? 0 : 1 }}
        >
          Nadient
        </div>
      </div>
    </div>
  );
}
