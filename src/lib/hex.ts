// Flat-top hex grid, KOLONE su vertikalne (kao original), naizmenično 7 i 8 polja visoke
// (9 kolona ukupno: 7-8-7-8-7-8-7-8-7), "even-c" offset (parne/kraće kolone pomerene naniže).
export interface OffsetHex { row: number; col: number }
export interface Cube { x: number; y: number; z: number }

export const COLS = 9;
/** maksimalna visina kolone (najduža kolona ima 8 polja) — granica petlji */
export const ROWS = 8;
/** stvarna visina konkretne kolone: parne kolone (0,2,4,6,8) imaju 7 polja, neparne 8 */
export const colLen = (col: number) => (col % 2 === 0 ? 7 : 8);

/** "even-c" offset -> axial/cube (parne kolone pomerene naniže) */
export function evencToCube({ row, col }: OffsetHex): Cube {
  const x = row - (col + (col & 1)) / 2;
  const z = col;
  return { x, y: -x - z, z };
}

export function cubeToEvenc(c: Cube): OffsetHex {
  const col = c.z;
  const row = c.x + (col + (col & 1)) / 2;
  return { row, col };
}

export function cubeRound(x: number, y: number, z: number): Cube {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

export function hexDistance(a: OffsetHex, b: OffsetHex): number {
  const ac = evencToCube(a), bc = evencToCube(b);
  return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2;
}

export function inBounds(h: OffsetHex) {
  return h.col >= 0 && h.col < COLS && h.row >= 0 && h.row < colLen(h.col);
}

const CUBE_DIRS: Cube[] = [
  { x: 1, y: -1, z: 0 }, { x: 1, y: 0, z: -1 }, { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 }, { x: -1, y: 0, z: 1 }, { x: 0, y: -1, z: 1 },
];

/** svih 6 susednih polja */
export function neighbors(h: OffsetHex): OffsetHex[] {
  const c = evencToCube(h);
  return CUBE_DIRS.map((d) => cubeToEvenc({ x: c.x + d.x, y: c.y + d.y, z: c.z + d.z })).filter(inBounds);
}

// Prava linija polja od a do b (uključujući oba kraja).
export function hexLine(a: OffsetHex, b: OffsetHex): OffsetHex[] {
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const ac = evencToCube(a), bc = evencToCube(b);
  const out: OffsetHex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = cubeRound(ac.x + (bc.x - ac.x) * t, ac.y + (bc.y - ac.y) * t, ac.z + (bc.z - ac.z) * t);
    out.push(cubeToEvenc(c));
  }
  return out;
}

// Da li su a i b na jednom od 6 pravih cube vektora?
export function isStraightLine(a: OffsetHex, b: OffsetHex): boolean {
  const ac = evencToCube(a), bc = evencToCube(b);
  const d = { x: bc.x - ac.x, y: bc.y - ac.y, z: bc.z - ac.z };
  return d.x === 0 || d.y === 0 || d.z === 0;
}

/* ── flat-top pixel geometrija (kolone vertikalne) ── */
export function hexToPixel(row: number, col: number, size: number) {
  const height = Math.sqrt(3) * size;     // razmak između centara u istoj koloni
  const horiz = size * 1.5;               // razmak između kolona
  const shifted = col % 2 === 0;          // kraće (parne) kolone su pomerene naniže
  const x = col * horiz + size;
  const y = row * height + (shifted ? height : height / 2);
  return { x, y };
}

export function boardDimensions(size: number) {
  const height = Math.sqrt(3) * size;
  return {
    w: (COLS - 1) * size * 1.5 + 2 * size,
    h: ROWS * height,
    hexW: 2 * size,
    hexH: height,
  };
}

/** flat-top heksagon (šiljak levo/desno) */
export function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (60 * i * Math.PI) / 180;
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

export function allHexes(): OffsetHex[] {
  const out: OffsetHex[] = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < colLen(c); r++) out.push({ row: r, col: c });
  return out;
}

export const eqHex = (a: OffsetHex | null | undefined, b: OffsetHex | null | undefined) =>
  !!a && !!b && a.row === b.row && a.col === b.col;

export const hexKey = (h: OffsetHex) => `${h.row},${h.col}`;
