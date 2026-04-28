"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hslCss } from "@/src/utils/color";
import type { HSL } from "@/src/utils/color";
import type { Mode } from "../types/play.types";

export default function PreviewScene({
  target,
  initialTime = 5,
  onContinue,
  paused = false,
}: {
  target: HSL;
  initialTime?: number;
  mode: Mode;
  isPractice: boolean;
  onContinue: () => void;
  paused?: boolean;
}) {
  const [introState, setIntroState] = useState<"READY" | "SET" | "GO!" | null>("READY");
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const finishedRef = useRef(false);
  const timeLeftRef = useRef(initialTime);

  const setSyncedTimeLeft = useCallback((value: number) => {
    timeLeftRef.current = value;
    setTimeLeft(value);
  }, []);

  useEffect(() => {
    if (paused || introState === null) return;

    const nextState = introState === "READY" ? "SET" : introState === "SET" ? "GO!" : null;
    const id = setTimeout(() => setIntroState(nextState), 800);
    return () => clearTimeout(id);
  }, [introState, paused]);

  useEffect(() => {
    if (introState !== null || paused) return;
    let lastTime: number | null = null;
    let req: number;
    const step = (ts: number) => {
      if (!lastTime) lastTime = ts;
      const delta = ts - lastTime;
      lastTime = ts;
      const remaining = Math.max(0, timeLeftRef.current * 1000 - delta);
      setSyncedTimeLeft(remaining / 1000);
      if (remaining > 0) {
        req = requestAnimationFrame(step);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        setTimeout(onContinue, 600);
      }
    };
    req = requestAnimationFrame(step);
    return () => cancelAnimationFrame(req);
  }, [introState, onContinue, paused, setSyncedTimeLeft]);

  return (
    <div className="game-zone max-w-3xl mx-auto page-enter">
      <div
        className="relative w-full rounded-2xl overflow-hidden border-2 border-border shadow-shadow transition-colors duration-1000"
        style={{
          backgroundColor: introState !== null ? "#171717" : hslCss(target),
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
          Lument
        </div>
      </div>
    </div>
  );
}
