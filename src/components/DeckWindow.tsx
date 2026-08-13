import { useEffect, useRef, useState } from "react";
import { artOf } from "@/lib/art";

/** Zaseban prozor za špil karata — samo se prevlači (drag), bez zoom-a i bez promene veličine. */
export function DeckWindow({ count, total }: { count: number; total: number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (pos) return;
    setPos({ x: Math.max(16, window.innerWidth - 140), y: 96 });
  }, [pos]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - drag.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy)),
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
      className="panel fixed z-40 flex select-none flex-col items-center gap-1 p-2"
      style={{ left: pos.x, top: pos.y, cursor: drag.current ? "grabbing" : "grab" }}
      onPointerDown={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      }}
    >
      <img src={artOf("card-back")} alt="Špil karata" className="h-24 w-16 rounded-md border border-[var(--color-gold)]/60 object-cover shadow-xl" />
      <span className="rounded bg-black/60 px-2 py-[2px] text-[10px] tracking-widest text-[var(--color-gold)]">
        ŠPIL {count}/{total}
      </span>
    </div>
  );
}
