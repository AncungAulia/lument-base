"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { hslCss } from "@/src/utils/color";
import type { HSL } from "@/src/utils/color";
import type React from "react";

export default function GuessScene({
  guess,
  setGuess,
  initialTime = 17,
  onSubmit,
  isPractice,
  target,
}: {
  guess: HSL;
  setGuess: (v: HSL) => void;
  initialTime?: number;
  onSubmit: () => void;
  isPractice: boolean;
  target: HSL;
}) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const submittedRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    if (isPractice) return;
    const duration = initialTime * 1000;
    let startTime: number | null = null;
    let req: number;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const remaining = Math.max(0, duration - (ts - startTime));
      setTimeLeft(remaining / 1000);
      if (remaining > 0) {
        req = requestAnimationFrame(step);
      } else if (!submittedRef.current) {
        submittedRef.current = true;
        onSubmitRef.current();
      }
    };
    req = requestAnimationFrame(step);
    return () => cancelAnimationFrame(req);
  }, [initialTime, isPractice]);

  return (
    <div className="game-zone max-w-3xl mx-auto page-enter">
      <div
        className="relative w-full rounded-2xl overflow-hidden border-2 border-border shadow-shadow"
        style={{ minHeight: "min(70vh,600px)" }}
      >
        <div className="absolute left-0 top-0 bottom-0 z-10 flex">
          {/* Hue slider */}
          <div
            className="w-12 sm:w-14 h-full relative cursor-pointer"
            style={{
              background: `linear-gradient(to bottom,#ff0000 0%,#ffff00 16.6%,#00ff00 33.3%,#00ffff 50%,#0000ff 66.6%,#ff00ff 83.3%,#ff0000 100%)`,
            }}
          >
            <input
              type="range" min={0} max={360} value={guess.h}
              onChange={(e) => setGuess({ ...guess, h: Number(e.target.value) })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ writingMode: "vertical-lr" as React.CSSProperties["writingMode"], direction: "ltr" }}
            />
            <div
              className="absolute left-1/2 w-8 h-8 bg-white rounded-full border-2 border-border shadow-lg pointer-events-none transition-all"
              style={{ top: `${(guess.h / 360) * 100}%`, transform: "translate(-50%,-50%)" }}
            />
          </div>
          {/* Saturation slider */}
          <div
            className="w-10 sm:w-12 h-full relative cursor-pointer"
            style={{
              background: `linear-gradient(to bottom,hsl(${guess.h},100%,${guess.l}%),hsl(${guess.h},0%,${guess.l}%))`,
            }}
          >
            <input
              type="range" min={0} max={100} value={guess.s}
              onChange={(e) => setGuess({ ...guess, s: Number(e.target.value) })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ writingMode: "vertical-lr" as React.CSSProperties["writingMode"], direction: "rtl" }}
            />
            <div
              className="absolute left-1/2 w-6 h-6 bg-white rounded-full border-2 border-border shadow-lg pointer-events-none transition-all"
              style={{ top: `${(1 - guess.s / 100) * 100}%`, transform: "translate(-50%,-50%)" }}
            />
          </div>
          {/* Lightness slider */}
          <div
            className="w-10 sm:w-12 h-full relative cursor-pointer"
            style={{
              background: `linear-gradient(to bottom,hsl(${guess.h},${guess.s}%,100%),hsl(${guess.h},${guess.s}%,50%),hsl(${guess.h},${guess.s}%,0%))`,
            }}
          >
            <input
              type="range" min={0} max={100} value={guess.l}
              onChange={(e) => setGuess({ ...guess, l: Number(e.target.value) })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              style={{ writingMode: "vertical-lr" as React.CSSProperties["writingMode"], direction: "rtl" }}
            />
            <div
              className="absolute left-1/2 w-6 h-6 bg-white rounded-full border-2 border-border shadow-lg pointer-events-none transition-all"
              style={{ top: `${(1 - guess.l / 100) * 100}%`, transform: "translate(-50%,-50%)" }}
            />
          </div>
        </div>

        <div
          className="absolute inset-0 transition-colors duration-100 ease-out"
          style={{ background: hslCss(guess) }}
        >
          {!isPractice && (
            <div className="absolute top-6 right-6 bg-black/20 px-4 py-2 rounded-full text-white text-xl font-heading">
              {timeLeft.toFixed(2)}s
            </div>
          )}
          <button
            onClick={onSubmit}
            className="absolute bottom-6 right-6 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border-2 border-border shadow-shadow flex items-center justify-center hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all cursor-pointer"
          >
            <ArrowRight className="w-6 h-6 text-foreground" />
          </button>
          {!isPractice && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
              <div
                className="h-full bg-white/60"
                style={{ width: `${(timeLeft / (initialTime || 17)) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
