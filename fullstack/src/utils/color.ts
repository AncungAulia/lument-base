export type HSL = { h: number; s: number; l: number };
export type RGB = { r: number; g: number; b: number };
export type TargetDifficulty = "easy" | "medium" | "hard" | "god";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function normalizeHsl(input: Partial<HSL> | null | undefined): HSL {
  const hRaw = Number(input?.h ?? 0);
  const sRaw = Number(input?.s ?? 0);
  const lRaw = Number(input?.l ?? 0);
  const h = Number.isFinite(hRaw) ? ((hRaw % 360) + 360) % 360 : 0;
  const s = Number.isFinite(sRaw) ? clamp(sRaw, 0, 100) : 0;
  const l = Number.isFinite(lRaw) ? clamp(lRaw, 0, 100) : 0;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = ln - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hslCss({ h, s, l }: HSL): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function rgbToLab({ r, g, b }: RGB) {
  const srgb = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  const [R, G, B] = srgb;
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X),
    fy = f(Y),
    fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE(hsl1: HSL, hsl2: HSL): number {
  const l1 = rgbToLab(hslToRgb(normalizeHsl(hsl1)));
  const l2 = rgbToLab(hslToRgb(normalizeHsl(hsl2)));
  const dL = l1.L - l2.L;
  const da = l1.a - l2.a;
  const db = l1.b - l2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function accuracyFromDeltaE(dE: number): number {
  return Math.max(0, Math.min(100, 100 - dE * 1.2));
}

export function accuracy(target: HSL, guess: HSL): number {
  return accuracyFromDeltaE(deltaE(target, guess));
}

export function tier(acc: number): {
  name: string;
  payout: number;
  color: string;
} {
  if (acc >= 98) return { name: "JACKPOT", payout: 10.0, color: "wf-fill-pk" };
  if (acc >= 90) return { name: "GREAT", payout: 7.5, color: "wf-fill-g" };
  if (acc >= 75) return { name: "GOOD", payout: 6.0, color: "wf-fill-y" };
  return { name: "MISS", payout: 0, color: "wf-fill-r" };
}

function buildTargetFromSeeds(
  [hSeed, sSeed, lSeed]: [number, number, number],
  difficulty: TargetDifficulty,
): HSL {
  const h = hSeed % 360;
  switch (difficulty) {
    case "easy":
      return { h, s: 72 + (sSeed % 24), l: 42 + (lSeed % 20) };
    case "hard": {
      const muted = sSeed % 2 === 0;
      const lightnessBand = lSeed % 3;
      return {
        h,
        s: muted ? 12 + (sSeed % 24) : 36 + (sSeed % 34),
        l:
          lightnessBand === 0
            ? 16 + (lSeed % 16)
            : lightnessBand === 1
              ? 66 + (lSeed % 16)
              : 32 + (lSeed % 26),
      };
    }
    case "god": {
      const satBand = sSeed % 3;
      const lightnessBand = lSeed % 4;
      return {
        h,
        s:
          satBand === 0
            ? sSeed % 10
            : satBand === 1
              ? 8 + (sSeed % 16)
              : 84 + (sSeed % 14),
        l:
          lightnessBand === 0
            ? 6 + (lSeed % 10)
            : lightnessBand === 1
              ? 14 + (lSeed % 10)
              : lightnessBand === 2
                ? 80 + (lSeed % 10)
                : 42 + (lSeed % 10),
      };
    }
    case "medium":
    default:
      return { h, s: 40 + (sSeed % 55), l: 35 + (lSeed % 40) };
  }
}

export function randomTarget(difficulty: TargetDifficulty = "medium"): HSL {
  return buildTargetFromSeeds(
    [
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
    ],
    difficulty,
  );
}

export function targetFromRoundId(
  roundId: string,
  difficulty: TargetDifficulty = "medium",
): HSL {
  const hex = roundId.replace("0x", "");
  const seeds: [number, number, number] = [
    parseInt(hex.slice(0, 2) || "00", 16),
    parseInt(hex.slice(2, 4) || "00", 16),
    parseInt(hex.slice(4, 6) || "00", 16),
  ];
  return buildTargetFromSeeds(seeds, difficulty);
}
