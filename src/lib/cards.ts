// GOSPODARI MAGIJE — deck database (creatures, spells, powers, equipment).
export type CardKind = "creature" | "spell" | "power" | "building" | "crystal" | "equipment";
export type Size = "XS" | "H" | "M" | "L" | "XL" | "W";
/** L = flyer, P = shooter, N = undead, J = mount, B = barrier/building, F = dragon fire, U = slays undead */
export type Trait = "L" | "P" | "N" | "J" | "B" | "F" | "U";

export interface CardDef {
  id: string;
  /** key into the artwork atlas (src/lib/art.ts) */
  art: string;
  name: string;
  kind: CardKind;
  size: Size;
  target: number; // crafting difficulty (roll D6 <= target)
  attack: number;
  defense: number;
  move: number;
  traits: Trait[];
  copies: number;
  hue: number;
  note?: string;
}

const c = (
  id: string, name: string, size: Size, target: number, attack: number, defense: number, move: number,
  copies: number, hue: number, traits: Trait[] = [], note?: string,
): CardDef => ({ id, art: id, name, kind: "creature", size, target, attack, defense, move, traits, copies, hue, note });

export const CARD_CATALOG: CardDef[] = [
  // ── Core pool ──
  c("ork", "Ork", "XS", 5, 1, 1, 1, 5, 90, ["P"], "Strelac — gađa na 1–3 polja"),
  c("konj", "Konj", "M", 4, 1, 1, 3, 4, 35, ["J"], "Jahaća životinja"),
  c("ljudozder", "Ljudožder", "H", 4, 2, 2, 1, 4, 15),
  c("vuk", "Vuk", "XS", 4, 3, 1, 2, 4, 40),
  c("zombi", "Zombi", "H", 4, 1, 1, 1, 4, 100, ["N"], "Nemrtvi"),
  c("slepi-mis", "Slepi Miš", "XS", 4, 1, 1, 3, 4, 270, ["L"], "Leteći"),
  { ...c("zid", "Zid", "XL", 4, 0, 3, 0, 4, 60, ["B"], "Prepreka / građevina"), kind: "building" },
  c("kentaur", "Kentaur", "M", 3, 1, 2, 3, 3, 30, ["J", "P"]),

  // ── Standard pool ──
  c("pegaz", "Pegaz", "M", 3, 1, 2, 4, 3, 200, ["J", "L"]),
  c("jednorog", "Jednorog", "M", 3, 3, 1, 3, 3, 190, ["J", "U"], "Ubija nemrtve"),
  c("sablast", "Sablast", "H", 3, 1, 2, 2, 3, 150, ["N"]),
  c("kostur", "Kostur", "H", 3, 2, 2, 2, 3, 0, ["N"]),
  c("utvara", "Utvara", "H", 3, 2, 1, 2, 3, 180, ["N"]),
  c("mumija", "Mumija", "H", 3, 1, 3, 1, 3, 45, ["N"]),
  c("lav", "Lav", "H", 3, 4, 2, 3, 3, 50),
  c("medved", "Medved", "L", 3, 3, 3, 3, 3, 30),
  c("krokodil", "Krokodil", "H", 3, 3, 3, 2, 3, 110),
  c("vilenjak", "Vilenjak", "H", 3, 2, 2, 2, 3, 70, ["P"]),
  c("grifon", "Grifon", "L", 3, 3, 2, 3, 3, 55, ["L"]),
  c("harpija", "Harpija", "H", 3, 2, 2, 3, 3, 320, ["L"]),
  c("minotaur", "Minotaur", "L", 3, 4, 3, 1, 3, 20),

  // ── Rare pool ──
  c("duh", "Duh", "H", 2, 3, 3, 2, 2, 240, ["N", "L"]),
  c("demon", "Demon", "L", 2, 5, 3, 4, 2, 10),
  c("hidra", "Hidra", "XL", 2, 5, 5, 1, 2, 160),
  c("dzin", "Džin", "XL", 2, 5, 4, 2, 2, 25),
  c("trol", "Trol", "L", 2, 4, 4, 3, 2, 135),

  // ── Legendary ──
  c("vampir", "Vampir", "H", 1, 4, 4, 3, 1, 350, ["N", "L"]),
  c("beli-zmaj", "Beli Zmaj", "XL", 1, 4, 5, 3, 1, 230, ["L", "F", "P"]),
  c("crni-zmaj", "Crni Zmaj", "XL", 1, 5, 4, 3, 1, 300, ["L", "F", "P"]),
  c("nebeski-zmaj", "Zlatni Zmaj", "XL", 1, 5, 5, 3, 1, 220, ["L", "F", "P"]),
  { ...c("kula", "Čarobnjačka Kula", "XL", 1, 0, 5, 0, 1, 65, ["B", "P", "J"], "Mag može ući u kulu"), kind: "building" },

  // ── Spell cards (drawn from the deck) ──
  { id: "munja", art: "munja", name: "Munja", kind: "spell", size: "W", target: 3, attack: 0, defense: 0, move: 0, traits: [], copies: 3, hue: 60, note: "Domet 4, prava linija, čist pogled" },
  { id: "vlast", art: "vlast", name: "Vlast", kind: "spell", size: "W", target: 3, attack: 0, defense: 0, move: 0, traits: [], copies: 3, hue: 210, note: "Domet 2, prava linija — preuzimaš biće" },
  { id: "haos", art: "haos", name: "Haos", kind: "spell", size: "W", target: 1, attack: 0, defense: 0, move: 0, traits: [], copies: 1, hue: 295, note: "Haos preuređuje bojno polje" },

  // ── Equipment / Unique Artifacts (7 ukupno, tačno po 1 primerak svaki) ──
  { id: "letece-cizme", art: "letece-cizme", name: "Leteće Čizme", kind: "equipment", size: "W", target: 4, attack: 0, defense: 0, move: 2, traits: [], copies: 1, hue: 195, note: "+2 kretanja magu" },
  { id: "krila", art: "krila", name: "Krila", kind: "equipment", size: "W", target: 4, attack: 0, defense: 0, move: 0, traits: ["L"], copies: 1, hue: 200, note: "Mag postaje leteći" },
  { id: "mac", art: "mac", name: "Mač", kind: "equipment", size: "W", target: 4, attack: 2, defense: 0, move: 0, traits: [], copies: 1, hue: 10, note: "+2 napada magu" },
  { id: "sekira", art: "sekira", name: "Sekira", kind: "equipment", size: "W", target: 4, attack: 3, defense: 0, move: 0, traits: [], copies: 1, hue: 20, note: "+3 napada magu" },
  { id: "oklop", art: "oklop", name: "Oklop", kind: "equipment", size: "W", target: 4, attack: 0, defense: 2, move: 0, traits: [], copies: 1, hue: 220, note: "+2 odbrane magu" },
  { id: "stit", art: "stit", name: "Štit", kind: "equipment", size: "W", target: 4, attack: 0, defense: 1, move: 0, traits: [], copies: 1, hue: 230, note: "+1 odbrane magu" },
  { id: "magicni-luk", art: "magicni-luk", name: "Magični Luk", kind: "equipment", size: "W", target: 4, attack: 1, defense: 0, move: 0, traits: ["P"], copies: 1, hue: 140, note: "Mag postaje strelac (+1 napada)" },

  // ── Power cards (univerzalne — bilo koji čarobnjak može da ih izvuče i koristi) ──
  { id: "moc", art: "moc", name: "Moć", kind: "power", size: "W", target: 6, attack: 0, defense: 0, move: 0, traits: [], copies: 12, hue: 45, note: "+1 kocka stvaranja — svaki mag drži najviše 3, četvrtu vraća u špil" },
];

export const CRYSTAL: CardDef = {
  id: "kristal", art: "kristal", name: "Kristal", kind: "crystal", size: "XL", target: 0, attack: 0, defense: 0, move: 0,
  traits: ["B"], copies: 9, hue: 55, note: "Neuništiva prepreka",
};

export interface DrawnCard extends CardDef {
  uid: string;
  /** round in which the card entered the hand — power cards are on cooldown for that round */
  gainedRound?: number;
}

/**
 * Weighted creation roll. Lower `target` = harder card (roll must be <= target).
 * Success odds are balanced instead of raw uniform d6:
 *   target 1–2 (legendary/heavy) ≈ 12–15%, target 3–4 (medium) ≈ 42–50%, target 5–6 (easy) ≈ 75–85%.
 * A hard success is never allowed twice in a row (anti luck-streak).
 */
const SUCCESS_ODDS: Record<number, number> = { 0: 0, 1: 0.12, 2: 0.15, 3: 0.42, 4: 0.5, 5: 0.78, 6: 0.85 };
let hardStreak = 0;

export function craftRoll(target: number): number {
  const t = Math.max(0, Math.min(6, target));
  let p = SUCCESS_ODDS[t] ?? t / 6;
  if (t <= 2 && hardStreak >= 1) p = p / 2; // prevent legendary luck streaks
  const success = Math.random() < p;
  if (t <= 2) hardStreak = success ? hardStreak + 1 : 0;
  const faces = [1, 2, 3, 4, 5, 6].filter((f) => (success ? f <= t : f > t));
  if (!faces.length) return 1 + Math.floor(Math.random() * 6);
  return faces[Math.floor(Math.random() * faces.length)];
}

export const DECK_SIZE = CARD_CATALOG.reduce((s, k) => s + k.copies, 0);

export function buildDeck(): DrawnCard[] {
  const deck: DrawnCard[] = [];
  for (const def of CARD_CATALOG) {
    for (let i = 0; i < def.copies; i++) {
      deck.push({ ...def, uid: `${def.id}-${i}-${Math.random().toString(36).slice(2, 7)}` });
    }
  }
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const has = (card: { traits: Trait[] }, t: Trait) => card.traits.includes(t);

export const traitLabel: Record<Trait, string> = {
  L: "Leteći", P: "Strelac", N: "Nemrtvi", J: "Jahaći", B: "Prepreka", F: "Zmajska vatra", U: "Ubija nemrtve",
};
