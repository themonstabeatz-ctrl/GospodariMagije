import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { artOf } from "@/lib/art";
import {
  allHexes, boardDimensions, eqHex, hexKey, hexPoints, hexToPixel, type OffsetHex,
} from "@/lib/hex";
import { PLAYER_META, effAttack, effDefense, glowColor, type PlayerId, type Unit } from "@/lib/game-types";

const HEX_SIZE = 44;

export function HexBoard({
  units, moveTargets, attackTargets, summonTargets, spellTargets, selectedUid, activeOwner, onHexClick, targetedUid, chaosUids,
}: {
  units: Unit[];
  moveTargets: OffsetHex[];
  attackTargets: OffsetHex[];
  summonTargets: OffsetHex[];
  spellTargets: OffsetHex[];
  selectedUid: string | null;
  /** only this player's units get the under-base aura */
  activeOwner: PlayerId;
  onHexClick: (h: OffsetHex) => void;
  /** uid trenutno napadnute jedinice — svi (napadač, branilac, gledaoci) vide crveni highlight, sinhronizovano preko mreže */
  targetedUid?: string | null;
  /** uid-ovi figura koje tokom Chaos faze još čekaju raspoređivanje — svi ih vide crveno dok se ne rasporede */
  chaosUids?: Set<string> | null;
}) {
  const dims = boardDimensions(HEX_SIZE);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  /* ceo prozor (okvir + mapa) se pomera po želji igrača, i menja veličinu sa SVE 4 strane */
  const [winPos, setWinPos] = useState<{ x: number; y: number } | null>(null);
  const [winSize, setWinSize] = useState<{ w: number; h: number } | null>(null);
  const winDrag = useRef<{ dx: number; dy: number } | null>(null);
  const resizeDrag = useRef<{
    edge: string; startX: number; startY: number; startW: number; startH: number; startPosX: number; startPosY: number;
  } | null>(null);

  useEffect(() => {
    if (winPos) return;
    setWinPos({ x: Math.max(8, window.innerWidth * 0.28), y: 96 });
  }, [winPos]);
  useEffect(() => {
    if (winSize) return;
    const w = Math.min(window.innerWidth * 0.6, 760);
    setWinSize({ w, h: w * (dims.h / dims.w) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winSize]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (resizeDrag.current) {
        const rd = resizeDrag.current;
        const dx = e.clientX - rd.startX;
        const dy = e.clientY - rd.startY;
        let w = rd.startW, h = rd.startH, x = rd.startPosX, y = rd.startPosY;
        if (rd.edge.includes("e")) w = Math.max(320, rd.startW + dx);
        if (rd.edge.includes("s")) h = Math.max(320, rd.startH + dy);
        if (rd.edge.includes("w")) { w = Math.max(320, rd.startW - dx); x = rd.startPosX + (rd.startW - w); }
        if (rd.edge.includes("n")) { h = Math.max(320, rd.startH - dy); y = rd.startPosY + (rd.startH - h); }
        setWinSize({ w, h });
        setWinPos({ x, y });
        return;
      }
      if (winDrag.current) {
        setWinPos({
          x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - winDrag.current.dx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - winDrag.current.dy)),
        });
      }
    };
    const up = () => { winDrag.current = null; resizeDrag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const startResize = (edge: string) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (!winSize || !winPos) return;
    resizeDrag.current = {
      edge, startX: e.clientX, startY: e.clientY,
      startW: winSize.w, startH: winSize.h, startPosX: winPos.x, startPosY: winPos.y,
    };
  };

  const clampZoom = (z: number) => Math.min(2.6, Math.max(0.5, z));
  const unitAt = (h: OffsetHex) => units.find((u) => eqHex(u.hex, h));
  const sel = units.find((u) => u.uid === selectedUid) ?? null;

  /* native non-passive wheel handler: zoom only the canvas, never scroll the page */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setZoom((z) => clampZoom(z - e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!winPos || !winSize) return null;

  const EDGES: { edge: string; cls: string; cursor: string }[] = [
    { edge: "n", cls: "left-2 right-2 top-0 h-1.5", cursor: "ns-resize" },
    { edge: "s", cls: "left-2 right-2 bottom-0 h-1.5", cursor: "ns-resize" },
    { edge: "w", cls: "top-2 bottom-2 left-0 w-1.5", cursor: "ew-resize" },
    { edge: "e", cls: "top-2 bottom-2 right-0 w-1.5", cursor: "ew-resize" },
    { edge: "nw", cls: "left-0 top-0 h-3 w-3", cursor: "nwse-resize" },
    { edge: "ne", cls: "right-0 top-0 h-3 w-3", cursor: "nesw-resize" },
    { edge: "sw", cls: "left-0 bottom-0 h-3 w-3", cursor: "nesw-resize" },
    { edge: "se", cls: "right-0 bottom-0 h-3 w-3", cursor: "nwse-resize" },
  ];

  return (
    <div
      className="panel relative flex select-none flex-col overflow-hidden"
      style={{
        position: "fixed", left: winPos.x, top: winPos.y, zIndex: 30,
        width: winSize.w, height: winSize.h, minWidth: 320, minHeight: 320,
      }}
    >
      {EDGES.map(({ edge, cls, cursor }) => (
        <div
          key={edge}
          className={`absolute z-10 ${cls}`}
          style={{ cursor }}
          onPointerDown={startResize(edge)}
        />
      ))}

      {/* drag handle — grabs the WHOLE window (okvir + mapa) */}
      <div
        className="flex shrink-0 cursor-grab items-center justify-between rounded-t-md border-b border-[var(--color-gold)]/30 bg-black/60 px-3 py-1.5 active:cursor-grabbing"
        onPointerDown={(e) => {
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
          winDrag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        }}
      >
        <span className="font-display text-[11px] tracking-[0.2em] text-[var(--color-gold)]">⠿ TABLA — prevuci da pomeriš, uhvati ivicu da promeniš veličinu</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(/board-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.35) 100%)" }} />

      <div
        ref={viewportRef}
        className="relative select-none overflow-hidden"
        style={{
          height: "100%", minHeight: 300, touchAction: "none", overscrollBehavior: "contain",
          cursor: drag.current ? "grabbing" : "grab",
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          e.preventDefault();
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          setPan({ x: d.px + dx, y: d.py + dy });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <div
          className="h-full w-full origin-center"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: drag.current ? "none" : "transform 0.12s ease-out" }}
        >
          <svg viewBox={`0 0 ${dims.w} ${dims.h}`} className="mx-auto block h-full w-full">
            <defs>
              <filter id="base-aura" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {allHexes().map((h) => {
              const { x, y } = hexToPixel(h.row, h.col, HEX_SIZE);
              const u = unitAt(h);
              const isAtk = attackTargets.some((m) => eqHex(m, h));
              const isSummon = summonTargets.some((m) => eqHex(m, h));
              const isSpell = spellTargets.some((m) => eqHex(m, h));
              const isMove = moveTargets.some((m) => eqHex(m, h));
              const isSel = sel && eqHex(sel.hex, h);
              const fill = isAtk ? "oklch(0.45 0.2 25 / 0.62)"
                : isSummon ? "oklch(0.55 0.16 145 / 0.5)"
                : isSpell ? "oklch(0.62 0.19 300 / 0.45)"
                : isMove ? "oklch(0.55 0.13 235 / 0.42)"
                : "oklch(0.22 0.02 45 / 0.32)";
              return (
                <g
                  key={hexKey(h)}
                  className="cursor-pointer"
                  onClick={() => { if (!drag.current?.moved) onHexClick(h); }}
                >
                  <polygon
                    points={hexPoints(x, y, HEX_SIZE - 1.5)}
                    fill={fill}
                    stroke={isSel ? "var(--color-gold)" : "oklch(0.75 0.02 80 / 0.35)"}
                    strokeWidth={isSel ? 3 : 1.2}
                  />
                  {u && <UnitToken u={u} x={x} y={y} active={u.owner === activeOwner} targeted={u.uid === targetedUid || !!chaosUids?.has(u.uid)} />}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex gap-1">
        {[["+", () => setZoom((z) => clampZoom(z + 0.2))], ["−", () => setZoom((z) => clampZoom(z - 0.2))],
          ["⟲", () => { setZoom(1); setPan({ x: 0, y: 0 }); }]].map(([label, fn]) => (
          <button
            key={label as string}
            onClick={fn as () => void}
            className="grid h-8 w-8 place-items-center rounded border border-[var(--color-gold)]/50 bg-black/60 text-sm text-[var(--color-gold)]"
          >
            {label as string}
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}

function UnitToken({ u, x, y, active, targeted }: { u: Unit; x: number; y: number; active: boolean; targeted?: boolean }) {
  const color = u.owner === 0 ? "oklch(0.8 0.14 60)" : PLAYER_META[u.owner as PlayerId].color;
  const r = HEX_SIZE - 6;
  const clipId = `clip-${u.uid}`;
  const showStats = u.owner !== 0;
  const aura = active && u.owner !== 0 ? glowColor(u.owner as PlayerId) : null;
  return (
    <g>
      {aura && (
        <ellipse
          cx={x} cy={y + r * 0.78} rx={r * 0.85} ry={r * 0.3}
          fill={aura} opacity={u.isWizard ? 0.95 : 0.5} filter="url(#base-aura)"
        />
      )}
      <defs>
        <clipPath id={clipId}>
          <polygon points={hexPoints(x, y, r)} />
        </clipPath>
      </defs>
      <image
        href={artOf(u.mount ? u.mount.art : u.card.art)}
        x={x - r} y={y - r} width={r * 2} height={r * 2}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />
      <polygon points={hexPoints(x, y, r)} fill="none" stroke={color} strokeWidth={2.5} />
      {targeted && (
        <polygon
          points={hexPoints(x, y, r + 4)}
          fill="none"
          stroke="oklch(0.58 0.24 25)"
          strokeWidth={3.5}
          opacity={0.95}
        >
          <animate attributeName="opacity" values="0.95;0.35;0.95" dur="0.9s" repeatCount="indefinite" />
        </polygon>
      )}
      {u.isWizard && (
        <g>
          <circle cx={x} cy={y - r * 0.78} r={8} fill="rgba(0,0,0,0.75)" stroke={color} strokeWidth={1.4} />
          <text x={x} y={y - r * 0.78 + 3.4} textAnchor="middle" fontSize="9" fill={color}>★</text>
        </g>
      )}
      {u.mount && (
        <text x={x} y={y + r * 0.05} textAnchor="middle" fontSize="15" fill="var(--color-gold)">🜲</text>
      )}
      {u.isWizard && !u.mount && (
        <g style={{ pointerEvents: "none" }}>
          {(() => {
            const badges: string[] = [];
            if (u.boots) badges.push("👢");
            if (u.wings) badges.push("🪽");
            if (u.weapon === "mac") badges.push("🗡️");
            if (u.weapon === "sekira") badges.push("🪓");
            if (u.armor === "oklop") badges.push("🛡️");
            if (u.armor === "stit") badges.push("🔰");
            if (u.bow) badges.push("🏹");
            return badges.map((b, i) => (
              <text
                key={b}
                x={x - r * 0.55 + i * (r * 0.55)}
                y={y + r * 0.85}
                textAnchor="middle"
                fontSize="11"
              >
                {b}
              </text>
            ));
          })()}
        </g>
      )}

      {showStats && (
        <g>
          <rect x={x - r + 3} y={y + r * 0.5} width={38} height={13} rx={3} fill="rgba(0,0,0,0.78)" />
          <text x={x - r + 22} y={y + r * 0.5 + 9.6} textAnchor="middle" fontSize="8.5" fill="oklch(0.9 0.06 80)">
            {effAttack(u)}/{effDefense(u)}
          </text>
        </g>
      )}
    </g>
  );
}
