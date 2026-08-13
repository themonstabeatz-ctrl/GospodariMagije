import { useEffect, useRef, useState } from "react";
import { PLAYER_META, portraitOf, type PlayerId } from "@/lib/game-types";

export interface StartConfig {
  mode: "solo" | "hotseat" | "online";
  seats: PlayerId[];
  localId: PlayerId;
  bots: PlayerId[];
  isHost: boolean;
  peer?: any;
  conns?: any[];
  hostConn?: any;
}

const ALL: PlayerId[] = [1, 2, 3, 4];
const roomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

/** Optimizovana WebRTC i PeerJS konfiguracija za trenutno otvaranje soba */
export const PEER_OPTS = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
  pingInterval: 5000,
  debug: 3,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun.relay.metered.ca:80" },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "02bd167223673aba0c7e11ba",
        credential: "8acAs76eeANAWdS+",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "02bd167223673aba0c7e11ba",
        credential: "8acAs76eeANAWdS+",
      },
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ],
  },
} as const;

export function MainMenu({ onStart }: { onStart: (c: StartConfig) => void }) {
  const [wizard, setWizard] = useState<PlayerId>(1);
  const [mode, setMode] = useState<"local" | "online">("local");
  const [slotType, setSlotType] = useState<Record<PlayerId, "bot" | "human" | "closed">>({
    1: "bot", 2: "bot", 3: "closed", 4: "closed",
  });
  const [lobby, setLobby] = useState<null | "host" | "join">(null);

  if (lobby) {
    return (
      <Lobby
        role={lobby}
        wizard={wizard}
        onBack={() => setLobby(null)}
        onStart={onStart}
      />
    );
  }

  const setSlot = (id: PlayerId, t: "bot" | "human" | "closed") => {
    setSlotType((s) => ({ ...s, [id]: s[id] === t ? "closed" : t }));
  };

  const startLocal = () => {
    const otherIds = ALL.filter((id) => id !== wizard);
    const active = otherIds.filter((id) => slotType[id] !== "closed");
    const bots = active.filter((id) => slotType[id] === "bot");
    onStart({ mode: "hotseat", seats: [wizard, ...active], localId: wizard, bots, isHost: true });
  };

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10 select-none">
      <div className="panel w-full max-w-3xl p-8 flex flex-col justify-between">
        <div>
          <h1 className="text-center font-display text-5xl text-gold-glow">GOSPODARI MAGIJE</h1>

          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {ALL.map((id) => (
              <WizardHex key={id} id={id} selected={wizard === id} onClick={() => setWizard(id)} />
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2">
            {(
              [
                ["local", "Lokalno"],
                ["online", "Online P2P"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`rounded-md border px-3 py-2 text-xs uppercase tracking-wider transition cursor-pointer ${
                  mode === k
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "local" ? (
            <div className="mt-5 space-y-3">
              <p className="text-center text-xs text-muted-foreground">
                Ti si {PLAYER_META[wizard].name}. LEVI klik na ostale magove = 🧑 Igrač (isti uređaj), DESNI klik = 🤖 Bot. Klik ponovo na isto stanje ga isključuje (— Prazno).
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ALL.filter((id) => id !== wizard).map((id) => {
                  const t = slotType[id];
                  const label = t === "bot" ? "🤖 Bot" : t === "human" ? "🧑 Igrač" : "— Prazno";
                  return (
                    <button
                      key={id}
                      onClick={() => setSlot(id, "human")}
                      onContextMenu={(e) => { e.preventDefault(); setSlot(id, "bot"); }}
                      className="cursor-pointer rounded border px-2 py-3 text-xs"
                      style={{
                        borderColor: t === "closed" ? undefined : PLAYER_META[id].color,
                        color: t === "closed" ? undefined : PLAYER_META[id].color,
                        opacity: t === "closed" ? 0.5 : 1,
                      }}
                    >
                      <div className="mb-1 font-display">{PLAYER_META[id].name}</div>
                      {label}
                    </button>
                  );
                })}
              </div>
              <button className="btn-arcane w-full rounded-md py-3 text-sm cursor-pointer" onClick={startLocal}>
                ZAPOČNI BITKU
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="btn-arcane rounded-md py-3 text-sm cursor-pointer" onClick={() => setLobby("host")}>
                KREIRAJ SOBU
              </button>
              <button className="btn-arcane rounded-md py-3 text-sm cursor-pointer" onClick={() => setLobby("join")}>
                PRIDRUŽI SE SOBI
              </button>
            </div>
          )}
        </div>

        {/* Potpis sa imenima i godinom */}
        <div className="mt-8 border-t border-border/40 pt-4 text-center text-xs text-muted-foreground opacity-80">
          <p>Igru napravio <span className="font-semibold text-foreground">MB!</span> (2026)</p>
          <p>Glavni idejni kreator: <span className="font-semibold text-foreground">Dr.Better</span></p>
        </div>
      </div>
    </main>
  );
}

function WizardHex({ id, selected, onClick, disabled }: { id: PlayerId; selected: boolean; onClick?: () => void; disabled?: boolean }) {
  const meta = PLAYER_META[id];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-center gap-2 transition ${
        disabled ? "opacity-30 cursor-not-allowed" : "hover:-translate-y-1 cursor-pointer"
      }`}
    >
      <span
        className="block h-28 w-24 overflow-hidden"
        style={{
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: selected ? meta.color : "oklch(0.3 0.02 60)",
          padding: selected ? 3 : 2,
          boxShadow: selected ? `0 0 26px ${meta.color}` : undefined,
        }}
      >
        <img
          src={portraitOf(id)}
          alt={meta.name}
          className="h-full w-full object-cover"
          style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
        />
      </span>
      <span className="font-display text-xs tracking-wider" style={{ color: meta.color }}>
        {meta.name}
      </span>
    </button>
  );
}

/* ───────────────────────── P2P lobby ───────────────────────── */

interface LobbySeat {
  peerId: string;
  wizard: PlayerId;
  ready: boolean;
}

function Lobby({
  role,
  wizard,
  onBack,
  onStart,
}: {
  role: "host" | "join";
  wizard: PlayerId;
  onBack: () => void;
  onStart: (c: StartConfig) => void;
}) {
  const [code, setCode] = useState(role === "host" ? roomCode() : "");
  const [status, setStatus] = useState(role === "host" ? "Inicijalizacija mreže..." : "Ukucajte kod sobe ispod.");
  const [seats, setSeats] = useState<LobbySeat[]>([]);
  const [myWizard, setMyWizard] = useState<PlayerId>(wizard);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // NOVO: koje od preostalih (nepopunjenih) mesta domaćin želi da popuni botom
  const [aiSlots, setAiSlots] = useState<Set<PlayerId>>(new Set());
  const aiSlotsRef = useRef<Set<PlayerId>>(new Set());
  useEffect(() => {
    aiSlotsRef.current = aiSlots;
  }, [aiSlots]);

  const inputRef = useRef<HTMLInputElement>(null);
  const peerRef = useRef<any>(null);
  const connsRef = useRef<any[]>([]);
  const hostConnRef = useRef<any>(null);
  const seatsRef = useRef<LobbySeat[]>([]);
  // NOVO: prati da li je igra već počela, da cleanup ne bi uništio vezu koja se koristi u igri
  const startedRef = useRef(false);

  // Prisilni fokus za unos koda
  useEffect(() => {
    if (role === "join") {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [role]);

  const pushSeats = (next: LobbySeat[]) => {
    seatsRef.current = next;
    setSeats(next);
    connsRef.current.forEach((c) => {
      try {
        c.send({ type: "lobby", seats: next });
      } catch {
        /* ignore */
      }
    });
  };

  /* Host otvara sobu */
  useEffect(() => {
    if (role !== "host") return;
    let cancelled = false;

    (async () => {
      try {
        const { default: Peer } = await import("peerjs");
        if (cancelled) return;

        const peer = new Peer(`gospodari-${code}`, PEER_OPTS);
        peerRef.current = peer;

        seatsRef.current = [{ peerId: "host", wizard: myWizard, ready: true }];
        setSeats(seatsRef.current);

        const openTimeout = setTimeout(() => {
          if (!cancelled && peer && !peer.open) {
            setStatus("Usporena veza sa serverom. Pokušavam ponovo...");
          }
        }, 10000);

        peer.on("open", () => {
          clearTimeout(openTimeout);
          if (!cancelled) {
            setStatus(`Soba je OTVORENA i spremna! Kod sobe: ${code}`);
          }
        });

        peer.on("error", (e: any) => {
          clearTimeout(openTimeout);
          if (!cancelled) {
            if (e?.type === "unavailable-id") {
              setStatus("Kod sobe je bio zauzet, kreiram novu sobu...");
              setCode(roomCode());
            } else {
              setStatus(`Mrežna greška (Host): ${e?.type ?? "Greška na serveru"}`);
            }
          }
        });

        peer.on("connection", (conn: any) => {
          conn.on("open", () => {
            connsRef.current = [...connsRef.current, conn];
            const taken = new Set(seatsRef.current.map((s) => s.wizard));
            const free = ALL.find((id) => !taken.has(id) && !aiSlotsRef.current.has(id)) ?? 4;
            pushSeats([...seatsRef.current, { peerId: conn.peer, wizard: free, ready: false }]);
            conn.send({ type: "assign", wizard: free, seats: seatsRef.current });
          });

          conn.on("data", (msg: any) => {
            if (msg?.type === "pick") {
              const taken = new Set(seatsRef.current.filter((s) => s.peerId !== conn.peer).map((s) => s.wizard));
              if (taken.has(msg.wizard)) return;
              pushSeats(seatsRef.current.map((s) => (s.peerId === conn.peer ? { ...s, wizard: msg.wizard } : s)));
            }
            if (msg?.type === "ready") {
              pushSeats(seatsRef.current.map((s) => (s.peerId === conn.peer ? { ...s, ready: !!msg.ready } : s)));
            }
          });

          conn.on("close", () => {
            connsRef.current = connsRef.current.filter((c) => c !== conn);
            pushSeats(seatsRef.current.filter((s) => s.peerId !== conn.peer));
          });
        });
      } catch (err) {
        if (!cancelled) setStatus("Greška: Nije moguće inicijalizovati mrežni modul.");
      }
    })();

    return () => {
      cancelled = true;
      // NOVO: ne uništavaj peer vezu ako je igra već počela — ona i dalje treba tu vezu
      if (peerRef.current && !startedRef.current) peerRef.current.destroy();
    };
  }, [role, code]);

  /* Gost se pridružuje */
  const joinRoom = async () => {
    if (!code || connecting) return;
    setConnecting(true);
    setStatus(`Povezivanje na sobu [${code}]...`);

    try {
      const { default: Peer } = await import("peerjs");
      const peer = new Peer(PEER_OPTS);
      peerRef.current = peer;

      const timer = setTimeout(() => {
        if (!connected) {
          setConnecting(false);
          setStatus("Vreme za povezivanje je isteklo. Domaćin nije dostupan.");
          try {
            peer.destroy();
          } catch {}
        }
      }, 10000);

      peer.on("error", (e: any) => {
        clearTimeout(timer);
        setConnecting(false);
        setStatus(`Neuspešno spajanje: Proverite kod sobe (${e?.type ?? "greška"})`);
      });

      peer.on("open", () => {
        const conn = peer.connect(`gospodari-${code}`, { reliable: true });
        hostConnRef.current = conn;

        conn.on("open", () => {
          clearTimeout(timer);
          setConnecting(false);
          setConnected(true);
          setStatus("USPEŠNO POVEZANO! Izaberite maga i potvrdite spremnost.");
        });

        conn.on("data", (msg: any) => {
          if (msg?.type === "assign") {
            setMyWizard(msg.wizard);
            setSeats(msg.seats ?? []);
          }
          if (msg?.type === "lobby") setSeats(msg.seats ?? []);
          if (msg?.type === "begin") {
            startedRef.current = true;
            onStart({
              mode: "online",
              seats: msg.seats,
              localId: msg.you,
              bots: msg.bots ?? [],
              isHost: false,
              peer,
              hostConn: conn,
            });
          }
        });

        conn.on("close", () => {
          setConnected(false);
          setStatus("Veza sa domaćinom je prekinuta.");
        });
      });
    } catch (e) {
      setConnecting(false);
      setStatus("Sistem ne može da inicijalizuje mrežni protokol.");
    }
  };

  const hostSetWizard = (id: PlayerId) => {
    if (seatsRef.current.some((s) => s.peerId !== "host" && s.wizard === id)) return;
    setMyWizard(id);
    pushSeats(seatsRef.current.map((s) => (s.peerId === "host" ? { ...s, wizard: id } : s)));
  };

  const clientSetWizard = (id: PlayerId) => {
    setMyWizard(id);
    try {
      hostConnRef.current?.send({ type: "pick", wizard: id });
    } catch {
      /* ignore */
    }
  };

  const toggleReady = () => {
    const next = !ready;
    setReady(next);
    try {
      hostConnRef.current?.send({ type: "ready", ready: next });
    } catch {
      /* ignore */
    }
  };

  const startGame = () => {
    // NOVO: obeleži da igra počinje PRE nego što React unmount-uje Lobby, da cleanup ne uništi vezu
    startedRef.current = true;
    const list = seatsRef.current;
    const humanIds = new Set(list.map((s) => s.wizard));
    const botIds = [...aiSlots].filter((id) => !humanIds.has(id));
    const order = [...list.map((s) => s.wizard), ...botIds];
    connsRef.current.forEach((c) => {
      const seat = list.find((s) => s.peerId === c.peer);
      try {
        c.send({ type: "begin", seats: order, you: seat?.wizard, bots: botIds });
      } catch {
        /* ignore */
      }
    });
    onStart({
      mode: "online",
      seats: order,
      localId: myWizard,
      bots: botIds,
      isHost: true,
      peer: peerRef.current,
      conns: connsRef.current,
    });
  };

  const takenByOthers = new Set(
    seats.filter((s) => (role === "host" ? s.peerId !== "host" : s.wizard !== myWizard)).map((s) => s.wizard)
  );
  const openSlots = role === "host" ? ALL.filter((id) => !seats.some((s) => s.wizard === id)) : [];
  const setAiSlot = (id: PlayerId, wantBot: boolean) => {
    setAiSlots((prev) => {
      const next = new Set(prev);
      if (wantBot) next.add(id); else next.delete(id);
      return next;
    });
  };
  const allReady = seats.every((s) => s.ready) && seats.length + aiSlots.size >= 2;

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10 select-none">
      <div className="panel w-full max-w-2xl p-8">
        <h1 className="text-center font-display text-3xl text-gold-glow">
          {role === "host" ? "SOBA DOMAĆINA" : "PRIDRUŽI SE SOBI"}
        </h1>

        <div className="mt-4 flex items-center justify-center gap-2">
          {role === "host" ? (
            <span className="rounded-md border border-[var(--color-gold)]/60 bg-black/40 px-5 py-2 font-display text-2xl tracking-[0.4em] text-[var(--color-gold)]">
              {code}
            </span>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="KOD SOBE"
                className="w-56 rounded border-2 border-[var(--color-gold)] bg-black px-4 py-2 text-center font-display text-xl tracking-[0.2em] text-[var(--color-gold)] outline-none focus:bg-zinc-900 cursor-text select-text"
              />
              <button
                className="btn-arcane rounded-md px-4 py-2 text-xs disabled:opacity-40 cursor-pointer"
                disabled={!code || connected || connecting}
                onClick={joinRoom}
              >
                {connecting ? "SPAJANJE..." : "POVEŽI SE"}
              </button>
            </>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground font-semibold">{status}</p>

        <div className="mt-6 grid grid-cols-4 gap-3">
          {ALL.map((id) => (
            <WizardHex
              key={id}
              id={id}
              selected={myWizard === id}
              disabled={takenByOthers.has(id) || (role === "host" && aiSlots.has(id)) || (role === "join" && !connected)}
              onClick={() => (role === "host" ? hostSetWizard(id) : clientSetWizard(id))}
            />
          ))}
        </div>

        <div className="mt-6 space-y-1">
          {seats.map((s) => (
            <div key={s.peerId} className="flex items-center justify-between rounded border border-border px-3 py-2 text-xs">
              <span style={{ color: PLAYER_META[s.wizard].color }}>
                {PLAYER_META[s.wizard].name}
                {s.peerId === "host" ? " (domaćin)" : ""}
              </span>
              <span className={s.ready ? "text-[var(--color-gold)] font-bold" : "text-muted-foreground"}>
                {s.ready ? "SPREMAN" : "čeka…"}
              </span>
            </div>
          ))}
          {role === "host" && openSlots.map((id) => (
            <button
              key={id}
              onClick={() => setAiSlot(id, false)}
              onContextMenu={(e) => { e.preventDefault(); setAiSlot(id, true); }}
              className="flex w-full cursor-pointer items-center justify-between rounded border border-dashed px-3 py-2 text-xs"
              style={{ borderColor: aiSlots.has(id) ? PLAYER_META[id].color : undefined }}
            >
              <span style={{ color: PLAYER_META[id].color }}>{PLAYER_META[id].name} (slobodno mesto)</span>
              <span className={aiSlots.has(id) ? "font-bold text-[var(--color-gold)]" : "text-muted-foreground"}>
                {aiSlots.has(id) ? "🤖 BOT (levi klik = otvori za igrača)" : "levi klik = čekaj igrača · desni klik = 🤖 bot"}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground cursor-pointer" onClick={onBack}>
            Nazad
          </button>
          {role === "join" && (
            <button
              className="btn-arcane flex-1 rounded-md py-2 text-xs disabled:opacity-40 cursor-pointer"
              disabled={!connected}
              onClick={toggleReady}
            >
              {ready ? "OTKAŽI SPREMNOST" : "SPREMAN"}
            </button>
          )}
          {role === "host" && (
            <button
              className="btn-arcane flex-1 rounded-md py-2 text-xs disabled:opacity-40 cursor-pointer"
              disabled={!allReady}
              onClick={startGame}
            >
              POKRENI IGRU
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
