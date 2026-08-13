import { useEffect, useState } from "react";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/** Sleek 3D-ish D6 that spins while rolling and settles on the value. */
export function Die({ value, rolling, size = 52 }: { value: number; rolling: boolean; size?: number }) {
  const [face, setFace] = useState(value || 1);

  useEffect(() => {
    if (!rolling) { setFace(value || 1); return; }
    const iv = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70);
    return () => clearInterval(iv);
  }, [rolling, value]);

  return (
    <span
      className="inline-grid place-items-center rounded-xl border border-[var(--color-gold)]/60"
      style={{
        width: size, height: size,
        background: "linear-gradient(150deg, oklch(0.32 0.02 70), oklch(0.14 0.02 55))",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 14px rgba(0,0,0,0.6)",
        transform: rolling ? undefined : "rotate(0deg)",
        animation: rolling ? "die-tumble 0.35s linear infinite" : undefined,
        transition: "transform 0.2s ease-out",
      }}
    >
      <svg viewBox="0 0 100 100" width={size * 0.74} height={size * 0.74}>
        {(PIPS[face] ?? PIPS[1]).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={9} fill="var(--color-gold)" />
        ))}
      </svg>
    </span>
  );
}

export function DiceRow({ values, rolling, size = 52 }: { values: number[]; rolling: boolean; size?: number }) {
  const shown = values.length ? values : rolling ? [1] : [];
  return (
    <span className="flex items-center gap-2">
      {shown.map((v, i) => <Die key={i} value={v} rolling={rolling} size={size} />)}
    </span>
  );
}
