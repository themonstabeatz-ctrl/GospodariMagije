import { useEffect, useRef, useState } from "react";
import { HexCard } from "@/components/HexCard";
import type { DrawnCard } from "@/lib/cards";

/** Draggable, collapsible floating hand tray. Cards auto-sort by creation difficulty. */
export function HandPanel({
  title, color, cards, selectedUid, disabled, lockedUids = [], onSelect,
}: {
  title: string;
  color?: string;
  cards: DrawnCard[];
  selectedUid: string | null;
  disabled: boolean;
  /** cards that cannot be played this turn (power card cooldown) */
  lockedUids?: string[];
  onSelect?: (uid: string) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(true);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (pos) return;
    setPos({ x: Math.max(16, window.innerWidth / 2 - 320), y: Math.max(80, window.innerHeight - 300) });
  }, [pos]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - drag.current.dx)),
        y: Math.max(0, Math.min(window.innerHeight - 50, e.clientY - drag.current.dy)),
      });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  if (!pos) return null;

  /* hardest / strongest first (lowest craft target = hardest roll), easiest last */
  const sorted = [...cards].sort((a, b) => a.target - b.target || a.name.localeCompare(b.name));

  return (
    <div className="panel fixed z-40 max-w-[92vw] select-none" style={{ left: pos.x, top: pos.y }}>
      <div
        className="flex cursor-grab items-center justify-between gap-4 rounded-t-md border-b border-[var(--color-gold)]/30 bg-black/50 px-3 py-2 active:cursor-grabbing"
        onPointerDown={(e) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        }}
      >
        <span className="font-display text-xs tracking-widest" style={{ color: color ?? "var(--color-gold)" }}>
          {title} ({cards.length})
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded border border-[var(--color-gold)]/40 px-2 text-[10px] text-[var(--color-gold)]"
        >
          {open ? "–" : "+"}
        </button>
      </div>
      {open && (
        <div className="flex max-w-[86vw] items-end gap-3 overflow-x-auto overflow-y-visible px-3 pb-4 pt-6">
          {sorted.map((card) => {
            const locked = lockedUids.includes(card.uid);
            return (
              <div key={card.uid} className="relative">
                <HexCard
                  card={card}
                  width={118}
                  selected={selectedUid === card.uid}
                  dim={disabled || locked}
                  onClick={onSelect && !disabled && !locked ? () => onSelect(card.uid) : undefined}
                />
                {locked && (
                  <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded bg-black/80 px-1 py-[2px] text-center text-[9px] tracking-wider text-[var(--color-gold)]">
                    SPREMNA SLEDEĆI KRUG
                  </span>
                )}
              </div>
            );
          })}
          {!cards.length && <span className="py-8 text-xs text-muted-foreground">Prazna ruka</span>}
        </div>
      )}
    </div>
  );
}
