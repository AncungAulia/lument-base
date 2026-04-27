export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function addrInitials(addr: string): string {
  return addr.slice(2, 4).toUpperCase();
}

export function addrTone(addr: string): 1 | 2 | 3 | 4 | 5 {
  let h = 0;
  for (let i = 2; i < addr.length; i++)
    h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return ((h % 5) + 1) as 1 | 2 | 3 | 4 | 5;
}

export function toneBg(tone: number): string {
  return [
    "bg-chart-1/25",
    "bg-chart-2/25",
    "bg-chart-3/30",
    "bg-chart-4/25",
    "bg-chart-5/25",
  ][tone - 1];
}

export function toneRing(tone: number): string {
  return ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"][
    tone - 1
  ];
}
