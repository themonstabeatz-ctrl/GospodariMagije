import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { artOf } from "@/lib/art";
import {
  ROWS, COLS, colLen, allHexes, eqHex, hexDistance, hexKey, hexLine, isStraightLine, neighbors, type OffsetHex,
} from "@/lib/hex";
import { buildDeck, craftRoll, CRYSTAL, DECK_SIZE, has, shuffle, type DrawnCard } from "@/lib/cards";
import { DeckWindow } from "@/components/DeckWindow";
import { HandPanel } from "@/components/HandPanel";
import { HexBoard } from "@/components/HexBoard";
import { MainMenu, type StartConfig } from "@/components/MainMenu";
import { Chronicle, type LogEntry } from "@/components/Chronicle";
import { DiceRow } from "@/components/Dice";
import {
  PLAYER_META, portraitOf, wizardCard, effAttack, effDefense, effMove,
  type GameMode, type Player, type PlayerId, type Stage, type Unit,
} from "@/lib/game-types";

export const Route = createFileRoute("/")({
  component: Game,
  head: () => ({
    meta: [
      { title: "Gospodari Magije — Taktička Heksagonalna Bitka" },
      { name: "description", content: "Gospodari Magije: turn-based hex tactics for 1–4 wizards — play vs AI or online, craft creatures, cast spells and destroy rival mages." },
      { property: "og:title", content: "Gospodari Magije — Taktička Heksagonalna Bitka" },
      { property: "og:description", content: "Craft creatures, cast Munja, Vlast and Haos, and duel rival wizards on a 9x9 hex battlefield — solo vs AI or online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/* ────────────────────────────── helpers ────────────────────────────── */

const d6 = () => 1 + Math.floor(Math.random() * 6);

function spawnHexes(count: number): OffsetHex[] {
  const midLeft = Math.floor(colLen(0) / 2);
  const midRight = Math.floor(colLen(COLS - 1) / 2);
  const bottomLeft = colLen(0) - 1;
  const bottomRight = colLen(COLS - 1) - 1;
  if (count <= 2) return [{ row: midLeft, col: 0 }, { row: midRight, col: COLS - 1 }];
  if (count === 3) return [{ row: 0, col: 0 }, { row: bottomLeft, col: 0 }, { row: midRight, col: COLS - 1 }];
  return [
    { row: 0, col: 0 }, { row: 0, col: COLS - 1 },
    { row: bottomLeft, col: 0 }, { row: bottomRight, col: COLS - 1 },
  ];
}

type Action =
  | { t: "roll" }
  | { t: "select"; cardUid: string | null }
  | { t: "hex"; hex: OffsetHex; selUid: string | null }
  | { t: "advance" }
  | { t: "end" }
  | { t: "dismount"; yes: boolean }
  | { t: "mount"; yes: boolean };

/** strict turn structure: creation rolls → movement (dice locked) → combat */
type TurnPhase = "cast" | "move" | "combat";

interface Snapshot {
  players: Player[]; units: Unit[]; deck: DrawnCard[]; discardPile: DrawnCard[];
  turn: PlayerId; round: number; stage: Stage; die: number[]; log: LogEntry[];
  pendingSummon: DrawnCard | null; pendingSpell: DrawnCard | null; setupCol: number;
  drew: boolean; created: boolean; seats: PlayerId[]; phase: TurnPhase;
  pendingAttack: { attUid: string; defUid: string } | null; attackHit: number | null;
  drawFailStreak: Record<PlayerId, number>;
  chaosQueue: string[] | null; chaosCaster: PlayerId | null; chaosRoll: number | null; chaosUid: string | null;
}

type DiceContext = "setup" | "draw" | "create" | "attack" | "defend" | null;

const DICE_LABEL: Record<Exclude<DiceContext, null>, string> = {
  setup: "BACI ZA POSTAVLJANJE KRISTALA",
  draw: "BACI KOCKU ZA KARTU",
  create: "PRIZOVI",
  attack: "BACI ZA NAPAD",
  defend: "BACI ZA ODBRANU",
};

/* ────────────────────────────── component ────────────────────────────── */

function Game() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [seats, setSeats] = useState<PlayerId[]>([]);
  const [stage, setStage] = useState<Stage>("setup");
  const [players, setPlayers] = useState<Player[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [deck, setDeck] = useState<DrawnCard[]>([]);
  const [discardPile, setDiscardPile] = useState<DrawnCard[]>([]);
  const [turn, setTurn] = useState<PlayerId>(1);
  const [round, setRound] = useState(1);
  const [setupCol, setSetupCol] = useState(0);

  const [die, setDie] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);
  const [drew, setDrew] = useState(false);
  const [created, setCreated] = useState(false);
  const [phase, setPhase] = useState<TurnPhase>("cast");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [pendingSummon, setPendingSummon] = useState<DrawnCard | null>(null);
  const [pendingSpell, setPendingSpell] = useState<DrawnCard | null>(null);
  const [pendingAttack, setPendingAttack] = useState<{ attUid: string; defUid: string } | null>(null);
  const [attackHit, setAttackHit] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [dismountAsk, setDismountAsk] = useState<OffsetHex | null>(null);
  const [mountAsk, setMountAsk] = useState<OffsetHex | null>(null);
  const [quitAsk, setQuitAsk] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  /** koliko puta zaredom je svaki igrač promašio izvlačenje karte — na 2 promašaja zaredom, 3. pokušaj je garantovan */
  const [drawFailStreak, setDrawFailStreak] = useState<Record<PlayerId, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  /** Chaos faza: null = nismo u haosu; inače lista uid-ova figura koje još čekaju raspoređivanje */
  const [chaosQueue, setChaosQueue] = useState<string[] | null>(null);
  const [chaosCaster, setChaosCaster] = useState<PlayerId | null>(null);
  const [chaosRoll, setChaosRoll] = useState<number | null>(null);
  const [chaosUid, setChaosUid] = useState<string | null>(null);

  /* online */
  const [localId, setLocalId] = useState<PlayerId>(1);
  const [isHost, setIsHost] = useState(true);
  const peerRef = useRef<any>(null);
  const connsRef = useRef<any[]>([]);
  const hostConnRef = useRef<any>(null);
  const pendingRemote = useRef<Action[]>([]);

  const online = mode === "online";
  const authoritative = !online || isHost;

  const cur = players.find((p) => p.id === turn);
  const say = useCallback((text: string, who?: PlayerId) => {
    const color = who ? PLAYER_META[who].log : "oklch(0.82 0.03 80)";
    setLog((l) => [{ text, color }, ...l].slice(0, 200));
  }, []);

  const wizardOf = useCallback((id: PlayerId) => units.find((u) => u.isWizard && u.owner === id), [units]);
  const unitAt = useCallback((h: OffsetHex) => units.find((u) => eqHex(u.hex, h)), [units]);
  const updatePlayer = (id: PlayerId, patch: Partial<Player>) =>
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  /** tokom faze odbrane, kontrola (i "viewerId" u lokalnom modu) mora da pripadne VLASNIKU napadnute figure, ne napadaču */
  const pendingDefenderId = (() => {
    if (!pendingAttack || attackHit === null) return null;
    const def = units.find((u) => u.uid === pendingAttack.defUid);
    return def && def.owner !== 0 ? (def.owner as PlayerId) : null;
  })();
  const viewerId: PlayerId = online ? localId : mode === "solo" ? localId : (pendingDefenderId ?? turn);
  const viewer = players.find((p) => p.id === viewerId);
  const pendingDefenderPlayer = pendingDefenderId ? players.find((p) => p.id === pendingDefenderId) : null;
  const myTurn = pendingDefenderId
    ? viewerId === pendingDefenderId && !!pendingDefenderPlayer && !pendingDefenderPlayer.isBot
    : turn === viewerId && !!cur && !cur.isBot;
  const canControl = myTurn && stage !== "over";

  /* ────────── setup ────────── */
  const startGame = (cfg: StartConfig) => {
    const ids = cfg.seats;
    let d = buildDeck();
    const ps: Player[] = ids.map((id) => {
      const hand = d.slice(0, 7).map((c) => ({ ...c, gainedRound: 0 }));
      d = d.slice(7);
      return {
        id, name: PLAYER_META[id].name, color: PLAYER_META[id].color, portrait: portraitOf(id),
        art: PLAYER_META[id].art, isBot: cfg.bots.includes(id), powers: 0, hand, alive: true,
      };
    });
    setMode(cfg.mode);
    setSeats(ids);
    setLocalId(cfg.localId);
    setIsHost(cfg.isHost);
    peerRef.current = cfg.peer ?? null;
    connsRef.current = cfg.conns ?? [];
    hostConnRef.current = cfg.hostConn ?? null;
    if (cfg.mode === "online" && cfg.isHost) {
      const wireConn = (c: any) => {
        c.on("data", (msg: any) => { if (msg?.type === "action") pendingRemote.current.push(msg.action); });
        c.on("close", () => {
          connsRef.current = connsRef.current.filter((x) => x !== c);
          say("🔌 Protivnik se odjavio (poku­šaće automatski da se vrati u igru).");
        });
        c.on("error", () => say("🔌 Problem sa vezom protivnika."));
      };
      (cfg.conns ?? []).forEach(wireConn);
      // NOVO: host i dalje sluša nove konekcije tokom same igre (npr. kad se neko vrati posle prekida)
      peerRef.current?.on("connection", (conn: any) => {
        conn.on("open", () => {
          connsRef.current = [...connsRef.current, conn];
          wireConn(conn);
          try { if (latestSnapshotRef.current) conn.send({ type: "state", snap: latestSnapshotRef.current }); } catch { /* ignore */ }
          say("🔌 Igrač se ponovo povezao.");
        });
      });
    }
    if (cfg.mode === "online" && !cfg.isHost && cfg.hostConn) {
      const hostPeerId = cfg.hostConn.peer;
      let reconnectTries = 0;
      const wireHostConn = (c: any) => {
        hostConnRef.current = c;
        c.on("data", (msg: any) => { if (msg?.type === "state") applySnapshot(msg.snap); });
        c.on("close", () => {
          say(`🔌 Veza sa domaćinom je prekinuta — pokušavam ponovo (${reconnectTries + 1}/5)…`);
          tryReconnect();
        });
        c.on("error", () => say("🔌 Problem sa vezom prema domaćinu."));
      };
      const tryReconnect = () => {
        if (reconnectTries >= 5 || !peerRef.current || peerRef.current.destroyed) {
          if (reconnectTries >= 5) say("🔌 Domaćin nije dostupan — veza je trajno prekinuta.");
          return;
        }
        reconnectTries++;
        setTimeout(() => {
          try {
            const conn = peerRef.current.connect(hostPeerId, { reliable: true });
            conn.on("open", () => { reconnectTries = 0; say("🔌 Ponovo povezan sa domaćinom!"); wireHostConn(conn); });
            conn.on("error", () => tryReconnect());
          } catch { tryReconnect(); }
        }, Math.min(2000 * reconnectTries, 8000));
      };
      wireHostConn(cfg.hostConn);
    }
    setPhase("cast");
    setPlayers(ps);
    setUnits([]);
    setDeck(d);
    setDiscardPile([]);
    setTurn(ids[0]);
    setRound(1);
    setSetupCol(0);
    setStage("setup");
    setDie([]);
    setDrawFailStreak({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setLog([{ text: "🔮 Postavljanje kristala — bacajte kocku za svaku kolonu.", color: "oklch(0.82 0.03 80)" }]);
  };

  const applySnapshot = (s: Snapshot) => {
    setPlayers(s.players); setUnits(s.units); setDeck(s.deck); setDiscardPile(s.discardPile);
    setTurn(s.turn); setRound(s.round); setStage(s.stage); setDie(s.die); setLog(s.log);
    setPendingSummon(s.pendingSummon); setPendingSpell(s.pendingSpell); setSetupCol(s.setupCol);
    setDrew(s.drew); setCreated(s.created); setSeats(s.seats); setPhase(s.phase);
    setPendingAttack(s.pendingAttack); setAttackHit(s.attackHit);
    setDrawFailStreak(s.drawFailStreak ?? { 1: 0, 2: 0, 3: 0, 4: 0 });
    setChaosQueue(s.chaosQueue ?? null); setChaosCaster(s.chaosCaster ?? null);
    setChaosRoll(s.chaosRoll ?? null); setChaosUid(s.chaosUid ?? null);
  };

  const latestSnapshotRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    if (!online || !isHost || !players.length) return;
    const snap: Snapshot = {
      players, units, deck, discardPile, turn, round, stage, die, log,
      pendingSummon, pendingSpell, setupCol, drew, created, seats, phase, pendingAttack, attackHit, drawFailStreak,
      chaosQueue, chaosCaster, chaosRoll, chaosUid,
    };
    latestSnapshotRef.current = snap;
    connsRef.current.forEach((c) => { try { c.send({ type: "state", snap }); } catch { /* ignore */ } });
  }, [online, isHost, players, units, deck, discardPile, turn, round, stage, die, log,
      pendingSummon, pendingSpell, setupCol, drew, created, seats, phase, pendingAttack, attackHit, drawFailStreak,
      chaosQueue, chaosCaster, chaosRoll, chaosUid]);

  useEffect(() => {
    if (!online || !isHost) return;
    const iv = setInterval(() => {
      const a = pendingRemote.current.shift();
      if (a) perform(a);
    }, 120);
    return () => clearInterval(iv);
  });

  /* ────────── crystal setup ────────── */
  const placeCrystal = (roll: number) => {
    const col = setupCol;
    const len = colLen(col);
    const bottomUp = col % 2 === 0; // 1-based odd columns count from the bottom
    let row = bottomUp ? len - roll : roll - 1;
    row = Math.max(0, Math.min(len - 1, row));
    const occupied = new Set(units.map((u) => hexKey(u.hex)));
    let guard = 0;
    let hex = { row, col };
    while (occupied.has(hexKey(hex)) && guard++ < len) {
      row = (row + 1) % len;
      hex = { row, col };
    }
    const crystal: Unit = {
      uid: `crystal-${col}`, owner: 0, card: { ...CRYSTAL, uid: `crystal-${col}` },
      hex, summonedOn: 0, moved: true, attacked: true,
    };
    setUnits((us) => [...us, crystal]);
    say(`💎 ${cur?.name}: kocka ${roll} — kristal u ${col + 1}. koloni (${bottomUp ? "odozdo" : "odozgo"}), red ${hex.row + 1}.`, turn);

    if (col + 1 >= COLS) {
      const spawns = spawnHexes(seats.length);
      setUnits((us) => {
        const withCrystals = [...us, crystal];
        const wizards: Unit[] = seats.map((id, i) => {
          let hex = spawns[i] ?? spawns[0];
          if (withCrystals.some((u) => eqHex(u.hex, hex))) {
            const free = neighbors(hex).find((n) => !withCrystals.some((u) => eqHex(u.hex, n)));
            if (free) hex = free;
          }
          return {
            uid: `wiz-${id}`, owner: id, card: wizardCard(id), hex, isWizard: true,
            mount: null, boots: false, summonedOn: 0, moved: false, attacked: false,
          };
        });
        return [...withCrystals, ...wizards];
      });
      setStage("play");
      setTurn(seats[0]);
      setSetupCol(COLS);
      say(`⚔ Svi kristali su postavljeni — bitka počinje! Na potezu: ${PLAYER_META[seats[0]].name}.`, seats[0]);
      return;
    }
    setSetupCol(col + 1);
    const idx = seats.indexOf(turn);
    setTurn(seats[(idx + 1) % seats.length]);
  };

  /* ────────── draw ────────── */
  const drawOne = (): { card: DrawnCard | null; rest: DrawnCard[]; recycled: boolean } => {
    if (deck.length) return { card: deck[0], rest: deck.slice(1), recycled: false };
    if (discardPile.length) {
      const re = shuffle(discardPile);
      return { card: re[0], rest: re.slice(1), recycled: true };
    }
    return { card: null, rest: [], recycled: false };
  };

  /* ────────── combat helpers ────────── */
  const blocked = useCallback((h: OffsetHex) => !!unitAt(h), [unitAt]);

  const glued = useCallback((u: Unit) =>
    neighbors(u.hex).some((n) => {
      const o = unitAt(n);
      return !!o && o.owner !== 0 && o.owner !== u.owner;
    }), [unitAt]);

  /** a wizard may enter the hex of a friendly mount (Konj/Kentaur/Pegaz/Jednorog) or Kula */
  const mountableFor = useCallback((u: Unit, h: OffsetHex) => {
    if (!u.isWizard || u.mount) return false;
    const o = unitAt(h);
    return !!o && o.owner === u.owner && !o.isWizard && has(o.card, "J");
  }, [unitAt]);

  const reachable = useCallback((u: Unit): OffsetHex[] => {
    const range = effMove(u);
    if (range <= 0 || u.moved) return [];
    if (glued(u)) return []; // ABSOLUTE lock: engaged units (incl. flyers) cannot move
    const flyer =
      has(u.card, "L") ||
      (u.isWizard && !!u.mount && has(u.mount, "L")) ||
      (u.isWizard && !!u.boots) ||
      (u.isWizard && !!u.wings);
    const mountable = (h: OffsetHex) => mountableFor(u, h);
    // flyers / booted wizards: identical step-by-step accounting to ground units (every tile costs
    // 1 movement point — no free teleporting), but they may PASS OVER obstacles/crystals/enemies
    // (that's what flying means) — they just still can't LAND on an occupied/blocked tile.
    if (flyer) {
      const enemyAdjacent = (h: OffsetHex) =>
        neighbors(h).some((n) => {
          const o = unitAt(n);
          return !!o && o.owner !== 0 && o.owner !== u.owner;
        });
      const seen = new Map<string, number>([[hexKey(u.hex), 0]]);
      let frontier = [u.hex];
      for (let step = 1; step <= range; step++) {
        const next: OffsetHex[] = [];
        for (const f of frontier) for (const n of neighbors(f)) {
          if (seen.has(hexKey(n))) continue;
          seen.set(hexKey(n), step);
          if (!enemyAdjacent(n)) next.push(n);
        }
        frontier = next;
      }
      return allHexes().filter((h) => seen.has(hexKey(h)) && !eqHex(h, u.hex) && (!blocked(h) || mountable(h)));
    }
    // ground units: BFS strictly limited by the card's movement stat, blocked by crystals/walls/units
    const seen = new Map<string, number>([[hexKey(u.hex), 0]]);
    let frontier = [u.hex];
    for (let step = 1; step <= range; step++) {
      const next: OffsetHex[] = [];
      for (const f of frontier) for (const n of neighbors(f)) {
        if (seen.has(hexKey(n))) continue;
        if (blocked(n) && !mountable(n)) continue; // path stops in front of obstacles
        seen.set(hexKey(n), step);
        if (!blocked(n)) next.push(n);
      }
      frontier = next;
    }
    return allHexes().filter((h) => seen.has(hexKey(h)) && !eqHex(h, u.hex));
  }, [blocked, glued, mountableFor]);

  const clearLine = useCallback((a: OffsetHex, b: OffsetHex) =>
    hexLine(a, b).slice(1, -1).every((h) => !unitAt(h)), [unitAt]);

  const canAttack = useCallback((att: Unit, def: Unit) => {
    if (att.owner === def.owner || att.attacked || effAttack(att) <= 0) return false;
    if (def.owner === 0) return false;
    const dist = hexDistance(att.hex, def.hex);
    if (has(att.card, "P") || (att.isWizard && att.bow)) return dist >= 1 && dist <= 3 && isStraightLine(att.hex, def.hex) && clearLine(att.hex, def.hex);
    return dist === 1;
  }, [clearLine]);

  const immune = (def: Unit, att: Unit) => {
    if (!has(def.card, "N")) return false;
    const attCard = att.isWizard && att.mount ? att.mount : att.card;
    return !(has(attCard, "N") || has(attCard, "P") || has(attCard, "F") || has(attCard, "U") || att.isWizard);
  };

  const destroy = (u: Unit) => {
    if (u.isWizard && u.mount) {
      setUnits((us) => us.map((x) => (x.uid === u.uid ? { ...x, mount: null } : x)));
      say(`🐴 ${u.mount.name} pada, ali ${u.card.name} preživljava.`, u.owner as PlayerId);
      return;
    }
    setUnits((us) => us.filter((x) => x.uid !== u.uid));
    if (u.owner !== 0 && !u.isWizard) setDiscardPile((d) => [...d, u.card]);
    if (u.isWizard && u.owner !== 0) {
      setUnits((us) => us.filter((x) => x.owner !== u.owner));
      setPlayers((ps) => {
        const updated = ps.map((p) => (p.id === u.owner ? { ...p, alive: false } : p));
        const left = updated.filter((p) => p.alive);
        if (left.length <= 1) {
          setStage("over");
          say(`👑 ${left[0]?.name ?? "Niko"} pobeđuje bitku!`, left[0]?.id);
        }
        return updated;
      });
      say(`☠️ ${u.card.name} je uništen — igrač je eliminisan!`, u.owner as PlayerId);
    } else {
      say(`💀 ${u.card.name} je uništen.`, u.owner === 0 ? undefined : (u.owner as PlayerId));
    }
  };

  /* ────────── unified dice roll ────────── */
  /** power cards obtained this round are on cooldown until the owner's next turn */
  const lockedCard = useCallback((_c: DrawnCard) => false, []);
  const lockedUids = useMemo(() => (viewer?.hand ?? []).filter(lockedCard).map((c) => c.uid), [viewer, lockedCard]);

  const diceContext: DiceContext =
    stage === "over" ? null
    : stage === "setup" ? "setup"
    : pendingAttack ? (attackHit === null ? "attack" : "defend")
    // dice are strictly locked while units are moving
    : phase !== "cast" ? null
    : !drew ? "draw"
    : selectedCard && !created ? "create"
    : null;

  /** who must physically throw the dice right now (defense is rolled by the defender) */
  const defender = pendingAttack ? units.find((u) => u.uid === pendingAttack.defUid) : null;
  const rollerId: PlayerId | null =
    diceContext === "defend" && defender && defender.owner !== 0 ? (defender.owner as PlayerId) : (cur?.id ?? null);
  const rollerPlayer = players.find((p) => p.id === rollerId) ?? null;
  const myRoll = !!rollerPlayer && !rollerPlayer.isBot && rollerPlayer.id === viewerId;

  const rollDice = () => {
    if (rolling || !cur || !diceContext) return;
    const ctx = diceContext;
    setRolling(true);
    setTimeout(() => {
      setRolling(false);
      if (ctx === "setup") {
        const r = d6();
        setDie([r]);
        placeCrystal(r);
        return;
      }
      if (ctx === "draw") {
        const r = d6();
        setDie([r]);
        setDrew(true);
        const streak = drawFailStreak[cur.id] ?? 0;
        const pity = streak >= 2; // 2 promašaja zaredom -> 3. pokušaj garantovan
        const success = r >= 4 || pity;
        if (success) {
          const { card, rest, recycled } = drawOne();
          if (!card) return say("🃏 Špil je prazan.", turn);
          const powerCount = cur.hand.filter((c) => c.kind === "power").length;
          if (card.kind === "power" && powerCount >= 3) {
            // mag već drži maksimalna 3 primerka Moći — četvrta se vraća u špil za druge magove
            setDeck(shuffle([...rest, card]));
            if (recycled) setDiscardPile([]);
            setDrawFailStreak((s) => ({ ...s, [cur.id]: 0 }));
            say(`🎲 ${cur.name}: ${r} — izvučena Moć, ali već ima 3 — vraća se u špil.`, cur.id);
            return;
          }
          setDeck(rest);
          if (recycled) setDiscardPile([]);
          updatePlayer(cur.id, { hand: [...cur.hand, { ...card, gainedRound: round }] });
          setDrawFailStreak((s) => ({ ...s, [cur.id]: 0 }));
          say(
            pity && r < 4
              ? `🎲 ${cur.name}: ${r} (treba 4+) — garantovana karta posle 2 promašaja.`
              : `🎲 ${cur.name}: ${r} (treba 4+) — izvučena karta.`,
            cur.id
          );
        } else {
          setDrawFailStreak((s) => ({ ...s, [cur.id]: streak + 1 }));
          say(`🎲 ${cur.name}: ${r} (treba 4+) — bez izvlačenja.`, cur.id);
        }
        return;
      }
      if (ctx === "create") return resolveCreation();
      if (ctx === "attack") return resolveAttackRoll();
      if (ctx === "defend") return resolveDefenseRoll();
    }, 620);
  };

  const resolveCreation = () => {
    if (!cur) return;
    const card = cur.hand.find((c) => c.uid === selectedCard);
    if (!card) return;
    if (lockedCard(card)) {
      setSelectedCard(null);
      return say(`⏳ ${card.name} je tek stečena — može se igrati tek u sledećem krugu.`, cur.id);
    }
    // NOVO: ako je mag potpuno opkoljen, preskoči stvaranje bića bez trošenja karte
    if (card.kind === "creature") {
      const wiz = wizardOf(cur.id);
      const hasFreeSpot = wiz && neighbors(wiz.hex).some((h) => !unitAt(h));
      if (!hasFreeSpot) {
        setSelectedCard(null);
        setCreated(true);
        setDie([]);
        return say(`🧱 ${cur.name} je potpuno opkoljen — stvaranje ${card.name} se preskače, karta ostaje u ruci.`, cur.id);
      }
    }
    setSelectedCard(null);
    setCreated(true);

    if (card.kind === "power") {
      updatePlayer(cur.id, { hand: cur.hand.filter((c) => c.uid !== card.uid), powers: cur.powers + 1 });
      setDiscardPile((d) => [...d, card]);
      setDie([]);
      say(`✨ ${cur.name} igra ${card.name} — sada ima ${cur.powers + 2} kocke stvaranja.`, cur.id);
      return;
    }

    const dice = 1 + cur.powers;
    const rolls = Array.from({ length: dice }, () => craftRoll(card.target));
    setDie(rolls);
    const success = rolls.some((r) => r <= card.target);
    updatePlayer(cur.id, { hand: cur.hand.filter((c) => c.uid !== card.uid) });

    if (!success) {
      setDiscardPile((d) => [...d, card]);
      say(`💥 ${cur.name} ne uspeva sa ${card.name} (${rolls.join(", ")} > ${card.target}).`, cur.id);
      return;
    }

    if (card.kind === "equipment") {
      setUnits((us) => us.map((u) => {
        if (!u.isWizard || u.owner !== cur.id) return u;
        if (card.id === "letece-cizme") return { ...u, boots: true };
        if (card.id === "krila") return { ...u, wings: true };
        if (card.id === "mac") return { ...u, weapon: "mac" };
        if (card.id === "sekira") return { ...u, weapon: "sekira" };
        if (card.id === "oklop") return { ...u, armor: "oklop" };
        if (card.id === "stit") return { ...u, armor: "stit" };
        if (card.id === "magicni-luk") return { ...u, bow: true };
        return u;
      }));
      setDiscardPile((d) => [...d, card]);
      say(`✨ ${cur.name} pravi ${card.name}.`, cur.id);
      return;
    }
    if (card.kind === "spell") {
      if (card.id === "haos") {
        castChaos(card);
        return;
      }
      setPendingSpell(card);
      say(`🔯 ${cur.name} priziva ${card.name} (${rolls.join(", ")} ≤ ${card.target}) — izaberi metu.`, cur.id);
      return;
    }
    setPendingSummon(card);
    say(`🛠 ${cur.name} stvara ${card.name} (${rolls.join(", ")} ≤ ${card.target}) — izaberi susedno polje.`, cur.id);
  };

  const resolveAttackRoll = () => {
    if (!pendingAttack) return;
    const att = units.find((u) => u.uid === pendingAttack.attUid);
    const def = units.find((u) => u.uid === pendingAttack.defUid);
    if (!att || !def) { setPendingAttack(null); setAttackHit(null); return; }
    const hit = d6();
    setDie([hit]);
    setUnits((us) => us.map((u) => (u.uid === att.uid ? { ...u, attacked: true, moved: true } : u)));
    if (hit <= effAttack(att)) {
      setAttackHit(hit);
      say(`⚔ ${att.card.name} pogađa (${hit} ≤ ${effAttack(att)}) — ${def.card.name} baca odbranu.`, att.owner as PlayerId);
    } else {
      setPendingAttack(null); setAttackHit(null);
      say(`🎲 ${att.card.name} promašuje ${def.card.name} (${hit} > ${effAttack(att)}).`, att.owner as PlayerId);
    }
  };

  const resolveDefenseRoll = () => {
    if (!pendingAttack) return;
    const def = units.find((u) => u.uid === pendingAttack.defUid);
    setPendingAttack(null);
    setAttackHit(null);
    if (!def) return;
    const save = d6();
    setDie([save]);
    if (save <= effDefense(def)) {
      say(`🛡 ${def.card.name} odbija napad (${save} ≤ ${effDefense(def)}).`, def.owner as PlayerId);
    } else {
      say(`💢 ${def.card.name} ne uspeva odbranu (${save} > ${effDefense(def)}).`, def.owner as PlayerId);
      destroy(def);
    }
  };

  /* ────────── board interaction ────────── */
  const doMove = (u: Unit, h: OffsetHex, dismount: boolean) => {
    const occupant = unitAt(h);
    // mounting a friendly mount creature
    if (occupant && occupant.owner === u.owner && !occupant.isWizard && has(occupant.card, "J") && u.isWizard && !u.mount) {
      setUnits((us) => us
        .filter((x) => x.uid !== occupant.uid)
        .map((x) => (x.uid === u.uid ? { ...x, hex: h, mount: occupant.card, moved: true } : x)));
      say(`🐎 ${u.card.name} uzjahuje ${occupant.card.name}.`, u.owner as PlayerId);
      return;
    }
    if (occupant) return;
    if (u.isWizard && u.mount && dismount) {
      const mountCard = u.mount;
      const oldHex = u.hex;
      setUnits((us) => [
        ...us.map((x) => (x.uid === u.uid ? { ...x, hex: h, mount: null, moved: true } : x)),
        {
          uid: `${mountCard.uid}-dis-${Math.random().toString(36).slice(2, 6)}`, owner: u.owner,
          card: mountCard, hex: oldHex, summonedOn: round, moved: true, attacked: true,
        },
      ]);
      say(`🚶 ${u.card.name} silazi sa ${mountCard.name}.`, u.owner as PlayerId);
      return;
    }
    setUnits((us) => us.map((x) => (x.uid === u.uid ? { ...x, hex: h, moved: true } : x)));
    say(`➡️ ${u.card.name} se pomera na (${h.row + 1}, ${h.col + 1}).`, u.owner === 0 ? undefined : (u.owner as PlayerId));
  };

  const onHexClick = (h: OffsetHex, selUid: string | null) => {
    if (!cur || stage !== "play") return;
    const target = unitAt(h);

    if (chaosQueue) {
      if (chaosUid) return chaosPlaceUnit(h);
      if (target && chaosQueue.includes(target.uid)) return chaosPickUnit(target.uid);
      return;
    }

    if (pendingSummon) {
      const wiz = wizardOf(cur.id);
      if (!wiz) { setPendingSummon(null); return; }
      if (target || hexDistance(wiz.hex, h) !== 1) return say("⚠️ Biće se stvara isključivo na praznom polju uz maga.", cur.id);
      setUnits((us) => [...us, {
        uid: pendingSummon.uid, owner: cur.id, card: pendingSummon, hex: h,
        summonedOn: round, moved: true, attacked: true,
      }]);
      say(`🌟 ${pendingSummon.name} se pojavljuje pored ${cur.name}.`, cur.id);
      setPendingSummon(null);
      return;
    }

    if (pendingSpell) return castSpell(pendingSpell, h);
    if (pendingAttack) return;

    if (target && target.owner === cur.id) {
      // clicking a friendly mount / tower next to an unmounted wizard offers to ride it
      // (leteći mag — Čizme +2 / Krila +3, sabiraju se do 5 — može da zajaše SAMO SVOJU zver
      // sa te udaljenosti, jednim potezom; target.owner===cur.id iznad već garantuje da je "svoja")
      const wiz = wizardOf(cur.id);
      const mountRange = wiz ? effMove(wiz) : 1;
      if (wiz && !wiz.mount && !wiz.moved && !target.isWizard && has(target.card, "J")
        && hexDistance(wiz.hex, target.hex) <= mountRange) {
        setSelectedUnit(wiz.uid);
        setMountAsk(target.hex);
        return;
      }
      setSelectedUnit(target.uid === selUid ? null : target.uid);
      return;
    }
    const sel = units.find((u) => u.uid === selUid);
    if (!sel || sel.owner !== cur.id) return;

    if (target && target.owner !== cur.id && target.owner !== 0) {
      if (phase !== "combat") return say("⚠️ Borba počinje tek kada završiš kretanje.", cur.id);
      if (!canAttack(sel, target)) return say("⚠️ Meta nije u dometu ili je jedinica već napala.", cur.id);
      if (immune(target, sel)) return say(`🚫 ${target.card.name} je imun na napad ${sel.card.name} — napad otkazan.`, cur.id);
      setPendingAttack({ attUid: sel.uid, defUid: target.uid });
      setAttackHit(null);
      say(`🎯 ${sel.card.name} napada ${target.card.name}.`, cur.id);
      return;
    }
    if (phase !== "move") return;
    if (!reachable(sel).some((r) => eqHex(r, h))) return;
    if (sel.isWizard && sel.mount && !unitAt(h)) { setDismountAsk(h); return; }
    doMove(sel, h, false);
  };

  const castSpell = (spell: DrawnCard, h: OffsetHex) => {
    if (!cur) return;
    const wiz = wizardOf(cur.id);
    if (!wiz) return;
    const target = unitAt(h);
    const dist = hexDistance(wiz.hex, h);

    if (spell.id === "munja") {
      if (!target || target.owner === cur.id || target.owner === 0) return say("⚠️ Munja mora pogoditi neprijateljsku jedinicu.", cur.id);
      if (dist > 4 || !isStraightLine(wiz.hex, h) || !clearLine(wiz.hex, h)) return say("⚠️ Nema čiste prave linije do mete (domet 4).", cur.id);
      say(`⚡ Munja pogađa ${target.card.name}!`, cur.id);
      destroy(target);
    } else if (spell.id === "vlast") {
      if (!target || target.owner === cur.id || target.owner === 0 || target.isWizard) return say("⚠️ Vlast cilja neprijateljsko biće.", cur.id);
      if (dist > 2 || !isStraightLine(wiz.hex, h) || !clearLine(wiz.hex, h)) return say("⚠️ Vlast ima domet 2 u pravoj liniji sa čistim pogledom.", cur.id);
      setUnits((us) => us.map((u) => (u.uid === target.uid ? { ...u, owner: cur.id, moved: true, attacked: true } : u)));
      say(`✊ ${cur.name} preuzima kontrolu nad ${target.card.name}!`, cur.id);
    }
    setDiscardPile((d) => [...d, spell]);
    setPendingSpell(null);
  };

  const castChaos = (spell: DrawnCard) => {
    if (!cur) return;
    setDiscardPile((d) => [...d, spell]);
    setChaosCaster(cur.id);
    setChaosQueue(units.filter((u) => u.owner !== 0).map((u) => u.uid));
    setChaosRoll(null);
    setChaosUid(null);
    say(`🌀 ${cur.name} baca Haos — sve figure na tabli se odvezuju i moraju biti raspoređene.`, cur.id);
  };

  /** kretanje tokom Chaos faze: ignoriše "zalepljenost" (glued) jer Haos odvezuje sve figure, koristi bačeni broj umesto standardnog dometa */
  const chaosReachable = useCallback((u: Unit, range: number): OffsetHex[] => {
    if (range <= 0) return [];
    const flyer =
      has(u.card, "L") ||
      (u.isWizard && !!u.mount && has(u.mount, "L")) ||
      (u.isWizard && !!u.boots) ||
      (u.isWizard && !!u.wings);
    const mountable = (h: OffsetHex) => mountableFor(u, h);
    if (flyer) {
      const enemyAdjacent = (h: OffsetHex) =>
        neighbors(h).some((n) => {
          const o = unitAt(n);
          return !!o && o.owner !== 0 && o.owner !== u.owner;
        });
      const seen = new Map<string, number>([[hexKey(u.hex), 0]]);
      let frontier = [u.hex];
      for (let step = 1; step <= range; step++) {
        const next: OffsetHex[] = [];
        for (const f of frontier) for (const n of neighbors(f)) {
          if (seen.has(hexKey(n))) continue;
          seen.set(hexKey(n), step);
          if (!enemyAdjacent(n)) next.push(n);
        }
        frontier = next;
      }
      return allHexes().filter((h) => seen.has(hexKey(h)) && !eqHex(h, u.hex) && (!blocked(h) || mountable(h)));
    }
    const seen = new Map<string, number>([[hexKey(u.hex), 0]]);
    let frontier = [u.hex];
    for (let step = 1; step <= range; step++) {
      const next: OffsetHex[] = [];
      for (const f of frontier) for (const n of neighbors(f)) {
        if (seen.has(hexKey(n))) continue;
        if (blocked(n) && !mountable(n)) continue;
        seen.set(hexKey(n), step);
        if (!blocked(n)) next.push(n);
      }
      frontier = next;
    }
    return allHexes().filter((h) => seen.has(hexKey(h)) && !eqHex(h, u.hex));
  }, [blocked, mountableFor]);

  /** klik na figuru tokom Chaos faze: bira je za raspoređivanje i baca kocku za domet pomeranja */
  const chaosPickUnit = (uid: string) => {
    if (!chaosQueue?.includes(uid)) return;
    const roll = d6();
    setDie([roll]);
    setChaosUid(uid);
    setChaosRoll(roll);
    const u = units.find((x) => x.uid === uid);
    say(`🌀 Kocka (${roll}) — raspoređuje se ${u?.card.name ?? "figura"}.`, chaosCaster ?? undefined);
  };

  /** klik na polje (ili ponovni klik na istu figuru) tokom Chaos faze: pomera figuru (ili je ostavlja) i skida je sa liste */
  const chaosPlaceUnit = (h: OffsetHex) => {
    if (!chaosUid) return;
    const u = units.find((x) => x.uid === chaosUid);
    if (!u) return;
    const opts = chaosReachable(u, chaosRoll ?? 0);
    if (!eqHex(h, u.hex)) {
      if (!opts.some((o) => eqHex(o, h))) return say("⚠️ To polje nije u dometu bačene kocke.", chaosCaster ?? undefined);
      setUnits((us) => us.map((x) => (x.uid === chaosUid ? { ...x, hex: h } : x)));
    }
    const nextQueue = (chaosQueue ?? []).filter((id) => id !== chaosUid);
    setChaosQueue(nextQueue);
    setChaosUid(null);
    setChaosRoll(null);
    if (!nextQueue.length) {
      setChaosCaster(null);
      setDie([]);
      say("🌀 Haos se stišava — sve figure su raspoređene.");
    }
  };

  /* ────────── turn flow ────────── */
  const endTurn = useCallback(() => {
    if (!players.length) return;
    setSelectedUnit(null); setSelectedCard(null); setPendingSpell(null); setPendingSummon(null);
    setPendingAttack(null); setAttackHit(null); setDismountAsk(null); setMountAsk(null);
    setDie([]); setDrew(false); setCreated(false); setPhase("cast");
    const order = players.filter((p) => p.alive).map((p) => p.id);
    if (order.length <= 1) return;
    const idx = order.indexOf(turn);
    const nextId = order[(idx + 1) % order.length];
    if ((idx + 1) % order.length === 0) setRound((r) => r + 1);
    setUnits((us) => us.map((u) => (u.owner === nextId ? { ...u, moved: false, attacked: false } : u)));
    setTurn(nextId);
    say(`🔁 Potez prelazi na ${PLAYER_META[nextId].name}.`, nextId);
  }, [players, turn, say]);

  /** move the turn one step forward: creation → movement → combat */
  const advance = useCallback(() => {
    setSelectedCard(null);
    setPhase((p) => {
      if (p === "cast") { say("🚶 Kretanje — kockice su zaključane.", turn); return "move"; }
      if (p === "move") { say("⚔ Kretanje završeno — borba počinje.", turn); return "combat"; }
      return p;
    });
  }, [say, turn]);

  /* ────────── dispatcher ────────── */
  const perform = (a: Action) => {
    switch (a.t) {
      case "roll": return rollDice();
      case "select": return setSelectedCard(a.cardUid);
      case "hex": return onHexClick(a.hex, a.selUid);
      case "advance": return advance();
      case "end": return endTurn();
      case "mount": {
        const h = mountAsk;
        setMountAsk(null);
        if (!h || !a.yes) return;
        const wiz = cur ? wizardOf(cur.id) : null;
        if (wiz) doMove(wiz, h, false);
        return;
      }
      case "dismount": {
        const h = dismountAsk;
        setDismountAsk(null);
        const sel = units.find((u) => u.uid === selectedUnit);
        if (h && sel) doMove(sel, h, a.yes);
        return;
      }
    }
  };

  const act = (a: Action) => {
    if (online && !isHost) {
      if (a.t === "hex") {
        const target = unitAt(a.hex);
        if (target && target.owner === localId) { setSelectedUnit(target.uid === selectedUnit ? null : target.uid); }
      }
      if (a.t === "select") setSelectedCard(a.cardUid);
      try { hostConnRef.current?.send({ type: "action", action: a }); } catch { /* ignore */ }
      return;
    }
    perform(a);
  };

  /* ────────── AI ────────── */
  const botGuard = useRef<{ id: PlayerId | null; since: number }>({ id: null, since: 0 });

  useEffect(() => {
    if (!authoritative || !cur || !cur.isBot || rolling || stage === "over" || chaosQueue) return;
    // any observable progress refreshes the stall watchdog
    if (botGuard.current.id === turn) botGuard.current = { id: turn, since: Date.now() };
    const timer = setTimeout(() => {
      try { botStep(); } catch (err) {
        console.error(err);
        say("⚠️ AI greška — potez se automatski završava.", turn);
        endTurn();
      }
    }, 520);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoritative, turn, stage, phase, rolling, drew, created, units, players, pendingSummon, pendingSpell, pendingAttack, attackHit, setupCol, selectedCard, selectedUnit]);


  /* Bot brani: kad je BRANILAC bot (bez obzira čiji je "red"), on sam baca kocku odbrane */
  useEffect(() => {
    if (!authoritative || !pendingAttack || attackHit === null || rolling || stage === "over" || chaosQueue) return;
    if (!pendingDefenderPlayer?.isBot) return;
    const timer = setTimeout(() => {
      try { rollDice(); } catch (err) { console.error(err); say("⚠️ AI greška pri odbrani.", turn); }
    }, 520);
    return () => clearTimeout(timer);
  }, [authoritative, pendingAttack, attackHit, rolling, stage, chaosQueue, pendingDefenderPlayer]);


  /* Chaos faza: kad AI baci Haos, sam raspoređuje figure jednu po jednu */
  useEffect(() => {
    if (!authoritative || !chaosQueue || !chaosQueue.length || !chaosCaster) return;
    const casterIsBot = players.find((p) => p.id === chaosCaster)?.isBot;
    if (!casterIsBot) return;
    const timer = setTimeout(() => {
      if (chaosUid && chaosRoll != null) {
        const u = units.find((x) => x.uid === chaosUid);
        if (!u) { setChaosUid(null); setChaosRoll(null); return; }
        const opts = chaosReachable(u, chaosRoll);
        const dest = opts.length ? opts[Math.floor(Math.random() * opts.length)] : u.hex;
        chaosPlaceUnit(dest);
      } else {
        chaosPickUnit(chaosQueue[0]);
      }
    }, 420);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoritative, chaosQueue, chaosCaster, chaosUid, chaosRoll, units, players]);


  /** watchdog uvek mora da vidi SVE\u017ee vrednosti — inače "pauziraj dok čovek baca odbranu" nikad ne uspe da se aktivira */
  const diceContextRef = useRef(diceContext);
  const rollerPlayerRef = useRef(rollerPlayer);
  useEffect(() => {
    diceContextRef.current = diceContext;
    rollerPlayerRef.current = rollerPlayer;
  }, [diceContext, rollerPlayer]);

  useEffect(() => {
    if (!authoritative || !cur?.isBot || stage === "over" || chaosQueue) { botGuard.current = { id: null, since: 0 }; return; }
    if (botGuard.current.id !== turn) botGuard.current = { id: turn, since: Date.now() };
    const iv = setInterval(() => {
      // čovek koji baca odbranu legitimno pauzira botov potez — bez vremenskog ograničenja dok ne baci
      if (diceContextRef.current === "defend" && rollerPlayerRef.current && !rollerPlayerRef.current.isBot) {
        botGuard.current = { id: turn, since: Date.now() };
        return;
      }
      if (botGuard.current.id === turn && Date.now() - botGuard.current.since > 20000) {
        botGuard.current = { id: null, since: 0 };
        say("⏱ AI je zaglavio — potez se prekida.", turn);
        setPendingAttack(null); setAttackHit(null); setPendingSummon(null); setPendingSpell(null);
        if (stage === "setup") { setDie([]); placeCrystal(d6()); } else endTurn();
      }
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authoritative, turn, stage]);

  const botStep = () => {
    if (!cur || !cur.isBot) return;
    if (stage === "setup") return rollDice();
    if (stage !== "play") return;

    // defense is rolled by the defender — never auto-roll for a human player
    if (pendingAttack) {
      if (diceContext === "defend" && rollerPlayer && !rollerPlayer.isBot) return;
      return rollDice();
    }

    const enemies = units.filter((u) => u.owner !== 0 && u.owner !== cur.id);
    const mine = units.filter((u) => u.owner === cur.id);
    const wiz = wizardOf(cur.id);

    if (pendingSummon) {
      if (!wiz) { setPendingSummon(null); return; }
      const spots = neighbors(wiz.hex).filter((h) => !unitAt(h));
      if (!spots.length) { setPendingSummon(null); say("⚠️ Nema slobodnog polja — biće je izgubljeno.", cur.id); return; }
      const nearest = enemies.length ? enemies.reduce((a, b) => (hexDistance(wiz.hex, a.hex) <= hexDistance(wiz.hex, b.hex) ? a : b)) : null;
      const spot = nearest ? spots.reduce((a, b) => (hexDistance(a, nearest.hex) <= hexDistance(b, nearest.hex) ? a : b)) : spots[0];
      return onHexClick(spot, null);
    }

    if (pendingSpell) {
      if (!wiz) { setPendingSpell(null); return; }
      const range = pendingSpell.id === "munja" ? 4 : 2;
      const victim = enemies.find((e) =>
        hexDistance(wiz.hex, e.hex) <= range && isStraightLine(wiz.hex, e.hex) && clearLine(wiz.hex, e.hex)
        && (pendingSpell.id === "munja" || !e.isWizard));
      if (!victim) {
        setDiscardPile((d) => [...d, pendingSpell]);
        setPendingSpell(null);
        say(`💨 ${cur.name} nema metu za ${pendingSpell.name}.`, cur.id);
        return;
      }
      return castSpell(pendingSpell, victim.hex);
    }

    /* ── creation phase ── */
    if (phase === "cast") {
      if (!drew) return rollDice();
      const playable = cur.hand.filter((c) => !lockedCard(c));
      if (!created && playable.length) {
        if (!selectedCard || !playable.some((c) => c.uid === selectedCard)) {
          const best = [...playable].sort((a, b) =>
            (b.kind === "power" ? 99 : b.target * 2 + b.attack + b.defense) -
            (a.kind === "power" ? 99 : a.target * 2 + a.attack + a.defense))[0];
          setSelectedCard(best.uid);
          return;
        }
        return rollDice();
      }
      return advance();
    }

    /* ── movement phase (no dice) ── */
    if (phase === "move") {
      /* AI wizard: defensive backline behaviour — flee from melee threats, never brawl unmounted */
      if (wiz && !wiz.moved && !wiz.mount) {
        const threats = enemies.filter((e) => !e.isWizard && effAttack(e) >= 3);
        const danger = (h: OffsetHex) =>
          threats.reduce((m, e) => Math.min(m, hexDistance(h, e.hex) - effMove(e)), 99);
        if (threats.length && danger(wiz.hex) <= 1 && !glued(wiz)) {
          const opts = reachable(wiz);
          if (opts.length) {
            const safest = opts.reduce((a, b) => (danger(a) >= danger(b) ? a : b));
            if (danger(safest) > danger(wiz.hex)) return doMove(wiz, safest, false);
          }
        }
        // NOVO: iskoristi priliku da zajaše sopstvenu jahaću zver (konj/pegaz/grifon/jednorog/kentaur) — brži i jači bot
        if (!glued(wiz)) {
          const mountSpot = reachable(wiz).find((h) => {
            const occ = unitAt(h);
            return !!occ && occ.owner === wiz.owner && !occ.isWizard && has(occ.card, "J");
          });
          if (mountSpot) return doMove(wiz, mountSpot, false);
        }
      }
      const mover = mine.find((u) => !u.moved && !(u.isWizard && !u.mount) && reachable(u).length);
      if (mover && enemies.length) {
        const nearest = enemies.reduce((a, b) => (hexDistance(mover.hex, a.hex) <= hexDistance(mover.hex, b.hex) ? a : b));
        const opts = reachable(mover);
        const step = opts.reduce((a, b) => (hexDistance(a, nearest.hex) <= hexDistance(b, nearest.hex) ? a : b));
        if (hexDistance(step, nearest.hex) < hexDistance(mover.hex, nearest.hex)) return doMove(mover, step, false);
        setUnits((us) => us.map((u) => (u.uid === mover.uid ? { ...u, moved: true } : u)));
        return;
      }
      return advance();
    }

    /* ── combat phase ── */
    const attacker = mine.find((u) => !u.attacked && enemies.some((e) => canAttack(u, e) && !immune(e, u)));
    if (attacker) {
      const hitTarget = enemies.find((e) => canAttack(attacker, e) && !immune(e, attacker))!;
      setSelectedUnit(attacker.uid);
      setPendingAttack({ attUid: attacker.uid, defUid: hitTarget.uid });
      setAttackHit(null);
      say(`🎯 ${attacker.card.name} napada ${hitTarget.card.name}.`, cur.id);
      return;
    }
    return endTurn();
  };

  /* ────────── derived visuals ────────── */
  const selUnit = units.find((u) => u.uid === selectedUnit) ?? null;

  const moveTargets = useMemo(() => {
    if (chaosQueue && chaosUid && chaosRoll != null) {
      const u = units.find((x) => x.uid === chaosUid);
      return u ? chaosReachable(u, chaosRoll) : [];
    }
    return stage === "play" && phase === "move" && selUnit && selUnit.owner === viewerId && canControl && !pendingAttack ? reachable(selUnit) : [];
  }, [stage, phase, selUnit, viewerId, canControl, reachable, pendingAttack, chaosQueue, chaosUid, chaosRoll, units, chaosReachable]);
  const attackTargets = useMemo(
    () => (stage === "play" && phase === "combat" && selUnit && canControl && !pendingAttack
      ? units.filter((u) => canAttack(selUnit, u) && !immune(u, selUnit)).map((u) => u.hex)
      : []),
    [stage, phase, selUnit, units, canAttack, canControl, pendingAttack],
  );
  const summonTargets = useMemo(() => {
    if (!pendingSummon || !cur) return [];
    const wiz = wizardOf(cur.id);
    return wiz ? neighbors(wiz.hex).filter((h) => !unitAt(h)) : [];
  }, [pendingSummon, cur, wizardOf, unitAt]);
  const spellTargets = useMemo(() => {
    if (!pendingSpell || !cur) return [];
    const wiz = wizardOf(cur.id);
    if (!wiz) return [];
    const range = pendingSpell.id === "munja" ? 4 : 2;
    return units
      .filter((u) => u.owner !== 0 && u.owner !== cur.id && hexDistance(wiz.hex, u.hex) <= range
        && isStraightLine(wiz.hex, u.hex) && clearLine(wiz.hex, u.hex))
      .map((u) => u.hex);
  }, [pendingSpell, cur, wizardOf, units, clearLine]);

  const instruction = (() => {
    if (stage === "over") return "Bitka je završena.";
    if (chaosQueue) {
      if (chaosUid) return "🌀 Haos — odaberi polje za raspoređenu figuru (ili klikni istu figuru da je ostaviš gde jeste).";
      return `🌀 Haos — odaberi jednu od preostalih ${chaosQueue.length} crveno obeleženih figura za raspoređivanje.`;
    }
    if (stage === "setup") {
      const col = setupCol + 1;
      return `Baci kocku za postavljanje kristala u ${col}. koloni (${setupCol % 2 === 0 ? "odozdo nagore" : "odozgo nadole"}).`;
    }
    if (pendingAttack) return attackHit === null ? "Baci kocku za napad!" : "Baci kocku za odbranu!";
    if (pendingSummon) return "Odaberi prazno polje odmah pored maga za novo biće.";
    if (pendingSpell) return "Odaberi metu za čin.";
    if (phase === "cast") {
      if (!drew) return "1. Stvaranje — baci kocku za izvlačenje nove karte (potreban rezultat 4+).";
      if (!created) return "1. Stvaranje — odaberi kartu i baci kockice, ili pređi na kretanje.";
      return "1. Stvaranje završeno — pređi na kretanje figura.";
    }
    if (phase === "move") {
      if (selUnit && selUnit.owner === viewerId && glued(selUnit))
        return "2. Kretanje — jedinica je zalepljena u borbi. Pređi na borbu za napad.";
      return "2. Kretanje — kockice su zaključane. Pomeri figure, pa pređi na borbu.";
    }
    return "3. Borba — klikni svoju jedinicu pa protivnika, ili završi potez.";
  })();

  if (!mode || !players.length) return <MainMenu onStart={startGame} />;

  const diceLabel = diceContext ? DICE_LABEL[diceContext] : null;
  const canRoll = canControl && !!diceContext && !rolling && (diceContext !== "create" || !!selectedCard);

  return (
    <main className="h-screen overflow-hidden px-4 py-3 xl:px-8">
      <Chronicle entries={log} />

      <header className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold-glow">GOSPODARI MAGIJE</h1>
          <p className="text-[11px] uppercase tracking-[0.25em]" style={{ color: cur?.color }}>
            Runda {round} · {cur?.name}{cur?.isBot ? " (AI)" : ""}
            {online && ` · Ti si ${PLAYER_META[localId].name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DiceRow values={die} rolling={rolling} size={46} />
          <button className="btn-arcane rounded-md px-4 py-2 text-xs" onClick={() => setQuitAsk(true)}>
            Nova bitka
          </button>
        </div>
      </header>

      {/* dynamic contextual instruction banner */}
      <div className="panel mb-2 flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <p className="font-display text-lg font-semibold tracking-wide text-white" style={{ borderLeft: `4px solid ${cur?.color ?? "transparent"}`, paddingLeft: 10 }}>
          {chaosQueue ? instruction : canControl ? instruction : cur?.isBot ? "AI mag razmišlja…" : `Čeka se ${cur?.name}…`}
        </p>
        <div className="flex items-center gap-2">
          {diceLabel && (
            <button className="btn-arcane rounded-md px-5 py-2 text-xs disabled:opacity-40" disabled={!canRoll} onClick={() => act({ t: "roll" })}>
              🎲 {diceLabel}
            </button>
          )}
          {stage === "play" && phase !== "combat" && (
            <button
              className="btn-arcane rounded-md px-5 py-2 text-xs disabled:opacity-40"
              disabled={!canControl || !!pendingAttack || !!pendingSummon || !!pendingSpell}
              onClick={() => act({ t: "advance" })}
            >
              {phase === "cast" ? "POMERI FIGURE" : "PREĐI NA BORBU"}
            </button>
          )}
          {stage === "play" && (
            <button className="btn-arcane rounded-md px-5 py-2 text-xs disabled:opacity-40" disabled={!canControl || !!pendingAttack} onClick={() => act({ t: "end" })}>
              ZAVRŠI POTEZ
            </button>
          )}
        </div>
      </div>

      {stage === "over" && (
        <div className="panel mb-2 p-5 text-center">
          <h2 className="font-display text-2xl text-gold-glow">
            👑 {players.find((p) => p.alive)?.name ?? "Niko"} je poslednji Gospodar Magije!
          </h2>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_240px]">
        <div className="space-y-2">
          {players.filter((_, i) => i % 2 === 0).map((p) => (
            <PlayerPanel key={p.id} p={p} active={p.id === turn} mounted={!!wizardOf(p.id)?.mount} boots={!!wizardOf(p.id)?.boots} wings={!!wizardOf(p.id)?.wings} weapon={wizardOf(p.id)?.weapon ?? null} armor={wizardOf(p.id)?.armor ?? null} bow={!!wizardOf(p.id)?.bow} />
          ))}
        </div>

        <section className="space-y-2">
          <div className="relative">
            <HexBoard
              units={units}
              moveTargets={moveTargets}
              attackTargets={attackTargets}
              summonTargets={summonTargets}
              spellTargets={spellTargets}
              selectedUid={selectedUnit}
              activeOwner={turn}
              onHexClick={(h) => { if (canControl) act({ t: "hex", hex: h, selUid: selectedUnit }); }}
              targetedUid={pendingAttack?.defUid ?? null}
              chaosUids={chaosQueue ? new Set(chaosQueue) : null}
            />
          </div>

        </section>
        <DeckWindow count={deck.length} total={DECK_SIZE} />


        <div className="space-y-2">
          {players.filter((_, i) => i % 2 === 1).map((p) => (
            <PlayerPanel key={p.id} p={p} active={p.id === turn} mounted={!!wizardOf(p.id)?.mount} boots={!!wizardOf(p.id)?.boots} wings={!!wizardOf(p.id)?.wings} weapon={wizardOf(p.id)?.weapon ?? null} armor={wizardOf(p.id)?.armor ?? null} bow={!!wizardOf(p.id)?.bow} />
          ))}
          <div className="panel p-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Protivnici</p>
            {players.filter((p) => p.id !== viewerId).map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-[2px]">
                <img src={artOf("card-back")} alt="" className="h-8 w-5 rounded-sm border border-[var(--color-gold)]/40 object-cover" />
                <span className="text-[11px]" style={{ color: p.color }}>{p.name}:</span>
                <span className="text-[11px] text-muted-foreground">Broj karata ({p.hand.length})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* draggable, sorted hand window — fog of war (nikad ne prikazuje ruku bota) */}
      <HandPanel
        title={viewer && !viewer.isBot ? `${viewer.name.toUpperCase()} — TVOJA RUKA` : "RUKA (čeka se AI potez)"}
        color={viewer?.color}
        cards={viewer && !viewer.isBot ? viewer.hand : []}
        selectedUid={selectedCard}
        lockedUids={lockedUids}
        disabled={!canControl || created || phase !== "cast" || stage !== "play"}
        onSelect={(uid) => act({ t: "select", cardUid: uid === selectedCard ? null : uid })}
      />

      {mountAsk && canControl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70">
          <div className="panel w-[320px] p-6 text-center">
            <p className="font-display text-sm text-[var(--color-gold)]">Želite li da jašete?</p>
            <div className="mt-5 flex gap-2">
              <button className="btn-arcane flex-1 rounded-md py-2 text-xs" onClick={() => act({ t: "mount", yes: true })}>Da, jašem</button>
              <button className="flex-1 rounded-md border border-border py-2 text-xs text-muted-foreground" onClick={() => act({ t: "mount", yes: false })}>Otkaži</button>
            </div>
          </div>
        </div>
      )}

      {dismountAsk && canControl && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70">
          <div className="panel w-[320px] p-6 text-center">
            <p className="font-display text-sm text-[var(--color-gold)]">Želite li da siđete?</p>
            <div className="mt-5 flex gap-2">
              <button className="btn-arcane flex-1 rounded-md py-2 text-xs" onClick={() => act({ t: "dismount", yes: true })}>Da, silazim</button>
              <button className="flex-1 rounded-md border border-border py-2 text-xs text-muted-foreground" onClick={() => act({ t: "dismount", yes: false })}>Ne, jašem dalje</button>
            </div>
          </div>
        </div>
      )}

      {quitAsk && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80">
          <div className="panel w-[360px] p-6 text-center">
            <p className="font-display text-sm text-[var(--color-gold)]">
              Da li stvarno želite da napustite trenutnu partiju koju već igrate?
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className="btn-arcane flex-1 rounded-md py-2 text-xs"
                onClick={() => { setQuitAsk(false); setMode(null); setPlayers([]); }}
              >
                DA / POTVRDI
              </button>
              <button
                className="flex-1 rounded-md border border-border py-2 text-xs text-muted-foreground"
                onClick={() => setQuitAsk(false)}
              >
                OTKAŽI / NASTAVI IGRU
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ────────────────────────────── subcomponents ────────────────────────────── */

function PlayerPanel({ p, active, mounted, boots, wings, weapon, armor, bow }: { p: Player; active: boolean; mounted: boolean; boots: boolean; wings: boolean; weapon: "mac" | "sekira" | null; armor: "oklop" | "stit" | null; bow: boolean }) {
  return (
    <div className={`panel p-3 transition-opacity ${active && p.alive ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <img src={p.portrait} alt={p.name} className={`h-12 w-12 rounded-full border-2 object-cover ${active ? "wizard-glow" : ""}`} style={{ borderColor: p.color }} />
        <div>
          <p className="font-display text-sm" style={{ color: p.color }}>{p.name}{p.isBot ? " 🤖" : ""}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {p.alive ? (active ? "Na potezu" : "Čeka") : "Eliminisan"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Kocke stvaranja {1 + p.powers} · Karte {p.hand.length}
        {boots ? " · 👢" : ""}{wings ? " · 🪽" : ""}{weapon === "mac" ? " · 🗡️" : ""}{weapon === "sekira" ? " · 🪓" : ""}{armor === "oklop" ? " · 🛡️" : ""}{armor === "stit" ? " · 🔰" : ""}{bow ? " · 🏹" : ""}{mounted ? " · 🐎" : ""}
      </p>
    </div>
  );
}
