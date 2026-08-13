import { artOf } from "@/lib/art";
import type { DrawnCard } from "@/lib/cards";
import type { OffsetHex } from "@/lib/hex";

export type PlayerId = 1 | 2 | 3 | 4;
/** setup = manual crystal placement, play = main turn loop */
export type Stage = "setup" | "play" | "over";
export type GameMode = "solo" | "hotseat" | "online";

export interface Unit {
  uid: string;
  owner: PlayerId | 0; // 0 = neutral (crystal)
  card: DrawnCard;
  hex: OffsetHex;
  isWizard?: boolean;
  /** creature the wizard is currently riding */
  mount?: DrawnCard | null;
  /** wizard has Leteće Čizme (+2 movement, leti) */
  boots?: boolean;
  /** wizard has Krila (+2 movement, leti) */
  wings?: boolean;
  /** naoružanje: Mač (+2 napad) ili Sekira (+3 napad) */
  weapon?: "mac" | "sekira" | null;
  /** zaštita: Oklop (+2 odbrana) ili Štit (+1 odbrana) */
  armor?: "oklop" | "stit" | null;
  /** Magični Luk — mag postaje strelac (+1 napad, gađa na daljinu) */
  bow?: boolean;
  summonedOn: number;
  moved: boolean;
  attacked: boolean;
}

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  portrait: string;
  art: string;
  isBot: boolean;
  powers: number;
  hand: DrawnCard[];
  alive: boolean;
}

export const PLAYER_META: Record<PlayerId, { name: string; color: string; art: string; log: string; panelBg: string; panelBorder: string }> = {
  1: { name: "Beli Mag", color: "oklch(0.92 0.02 90)", art: "mag-beli", log: "oklch(0.92 0.02 90)", panelBg: "oklch(0.18 0.01 80 / 0.6)", panelBorder: "oklch(0.92 0.02 90 / 0.5)" },
  2: { name: "Crni Mag", color: "#c084fc", art: "mag-crni", log: "#c084fc", panelBg: "#0a0014", panelBorder: "#6b21a8" },
  3: { name: "Crveni Mag", color: "oklch(0.62 0.22 25)", art: "mag-crveni", log: "oklch(0.66 0.22 25)", panelBg: "oklch(0.18 0.04 25 / 0.6)", panelBorder: "oklch(0.62 0.22 25 / 0.5)" },
  4: { name: "Zeleni Mag", color: "oklch(0.65 0.18 145)", art: "mag-zeleni", log: "oklch(0.7 0.18 145)", panelBg: "oklch(0.18 0.04 145 / 0.6)", panelBorder: "oklch(0.65 0.18 145 / 0.5)" },
};

/** glow color used under the active player's units on the board */
export const glowColor = (id: PlayerId) => (id === 2 ? "#6b21a8" : PLAYER_META[id].color);

export const portraitOf = (id: PlayerId) => artOf(PLAYER_META[id].art);

export const wizardCard = (id: PlayerId): DrawnCard => ({
  id: `wizard-${id}`,
  art: PLAYER_META[id].art,
  name: PLAYER_META[id].name,
  kind: "creature",
  size: "W",
  target: 0,
  attack: 1,
  defense: 1,
  move: 1,
  traits: [],
  copies: 1,
  hue: id === 1 ? 90 : id === 2 ? 300 : id === 3 ? 25 : 145,
  uid: `wiz-${id}`,
});

/** effective stats — wizards inherit the stats of the creature they ride, or their base + stacked artifact bonuses */
export const effMove = (u: Unit) => {
  if (!u.isWizard) return u.card.move;
  if (u.mount) return u.mount.move;
  const flightBonus = (u.boots ? 2 : 0) + (u.wings ? 3 : 0);
  return flightBonus > 0 ? flightBonus : 1;
};
export const effAttack = (u: Unit) => {
  if (!u.isWizard) return u.card.attack;
  if (u.mount) return u.mount.attack;
  const weaponBonus = u.weapon === "mac" ? 2 : u.weapon === "sekira" ? 3 : 0;
  return u.card.attack + weaponBonus + (u.bow ? 1 : 0);
};
export const effDefense = (u: Unit) => {
  if (!u.isWizard) return u.card.defense;
  if (u.mount) return u.mount.defense;
  const armorBonus = u.armor === "oklop" ? 2 : u.armor === "stit" ? 1 : 0;
  return u.card.defense + armorBonus;
};
