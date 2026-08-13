import { useEffect, useRef, useState } from "react";

export interface LogEntry { text: string; color: string }

/** Draggable floating chronicle widget. */
export function Chronicle({ entries }: { entries: LogEntry[] }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(true);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (pos) return;
    setPos({ x: 16, y: Math.max(80, window.innerHeight - 400) });
  }, [pos]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 260, e.clientX - drag.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.current.dy)),
      });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  if (!pos) return null;

  return (
    <div
      className="panel fixed z-40 w-[280px] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex cursor-grab items-center justify-between rounded-t-md border-b border-[var(--color-gold)]/30 bg-black/50 px-3 py-2 active:cursor-grabbing"
        onPointerDown={(e) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        }}
      >
        <span className="font-display text-xs tracking-widest text-gold-glow">HRONIKA</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded border border-[var(--color-gold)]/40 px-2 text-[10px] text-[var(--color-gold)]"
        >
          {open ? "–" : "+"}
        </button>
      </div>
      {open && (
        <ul className="max-h-[240px] space-y-1 overflow-y-auto px-3 py-2 text-[11px] leading-relaxed">
          {entries.map((e, i) => (
            <li key={i} style={{ color: e.color, opacity: i === 0 ? 1 : 0.82 }}>{e.text}</li>
          ))}
          {!entries.length && <li className="text-muted-foreground">Bitka još nije počela.</li>}
        </ul>
      )}
    </div>
  );
}
