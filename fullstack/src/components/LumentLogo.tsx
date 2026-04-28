import React from 'react';

export const LumentLogo = ({ className = "w-8 h-8" }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 1. Hard Drop Shadow */}
      <path
        d="M 50 10 L 62 38 L 90 50 L 62 62 L 50 90 L 38 62 L 10 50 L 38 38 Z"
        fill="var(--border)"
        transform="translate(4, 4)"
      />

      {/* 2. Outer Spark (Main Theme Color) */}
      <path
        d="M 50 10 L 62 38 L 90 50 L 62 62 L 50 90 L 38 62 L 10 50 L 38 38 Z"
        fill="var(--main)"
        stroke="var(--border)"
        strokeWidth="6"
        strokeLinejoin="round"
      />

      {/* 3. Inner Spark (Yellow Core) */}
      <path
        d="M 50 28 L 57 43 L 72 50 L 57 57 L 50 72 L 43 57 L 28 50 L 43 43 Z"
        fill="var(--chart-3)"
      />
    </svg>
  );
};
