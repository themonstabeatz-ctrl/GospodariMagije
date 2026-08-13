import type { CardDef, DrawnCard } from "@/lib/cards";
import { artOf } from "@/lib/art";

/** Clean hand card: full-res artwork + title only. No stat overlays, no size markers. */
export function HexCard({
  card,
  selected = false,
  dim = false,
  onClick,
  width = 132,
  className = "",
}: {
  card: CardDef | DrawnCard;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  width?: number;
  className?: string;
}) {
  const hue = card.hue;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={card.name}
      style={{ width, height: width * 1.42 }}
      className={`relative shrink-0 overflow-hidden rounded-xl border border-black/60 text-left transition-all duration-200
        ${selected ? "-translate-y-5 ring-2 ring-[var(--color-gold)]" : onClick ? "hover:-translate-y-2" : ""}
        ${dim ? "opacity-45 grayscale" : ""} ${className}`}
    >
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(170deg, oklch(0.42 0.1 ${hue}) 0%, oklch(0.16 0.05 ${hue}) 70%, oklch(0.09 0.03 ${hue}) 100%)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 18px rgba(0,0,0,0.55)",
        }}
      />
      <span className="relative flex h-full flex-col p-[5px]">
        <span className="relative block flex-1 overflow-hidden rounded-lg">
          <img
            src={artOf(card.art)}
            alt={card.name}
            draggable={false}
            className="h-full w-full object-cover object-center"
            style={{ imageRendering: "auto" }}
          />
          <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-[var(--color-gold)]/40" />
        </span>
        <span
          className="mt-[5px] block truncate text-center font-display font-bold tracking-wide text-[var(--color-gold)]"
          style={{ fontSize: Math.max(10, width * 0.095) }}
        >
          {card.name.toUpperCase()}
        </span>
      </span>
    </button>
  );
}
