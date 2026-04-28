"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { SVGProps } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowRight,
  IconBrain,
  IconBoltSmall,
  IconCalendar,
  IconChart,
  IconCheck,
  IconClock,
  IconCoin,
  IconCoins,
  IconCopy,
  IconEye,
  IconGame,
  IconGift,
  IconKey,
  IconLock,
  IconMail,
  IconPickaxe,
  IconSend,
  IconShare,
  IconShield,
  IconSparkles,
  IconTrend,
  IconTrophy,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import {
  startGameSession,
  finishGameSession,
  emitBalanceChange,
  getGameBalance,
} from "@/lib/game-session";

/* ============================================================
   Config
   ============================================================ */

type Difficulty = "easy" | "medium" | "hard";

type DifficultySpec = {
  id: Difficulty;
  label: string;
  pairs: number;
  cols: number;
  rows: number;
  multiplier: number;
};

const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  easy: { id: "easy", label: "Easy", pairs: 6, cols: 4, rows: 3, multiplier: 1 },
  medium: {
    id: "medium",
    label: "Medium",
    pairs: 8,
    cols: 4,
    rows: 4,
    multiplier: 1.5,
  },
  hard: { id: "hard", label: "Hard", pairs: 15, cols: 5, rows: 6, multiplier: 2 },
};

const FLIP_BACK_MS = 900;
const SCORE_BASE = 1000;
const SCORE_MOVE_PENALTY = 8;
const SCORE_TIME_PENALTY = 2;

// Mirrors the backend scoreToCoins formula for memory
const MEMORY_COINS_PER_SCORE = 0.3;
const MEMORY_MAX_SCORE = 1_000;
const MEMORY_MAX_COINS_SESSION = 300;

function previewCoins(score: number): number {
  return Math.min(
    Math.floor(Math.min(score, MEMORY_MAX_SCORE) * MEMORY_COINS_PER_SCORE),
    MEMORY_MAX_COINS_SESSION,
  );
}

type IconComp = (p: SVGProps<SVGSVGElement> & { size?: number }) => React.ReactNode;

// 15 visually distinct icons from the project's existing set — enough for hard.
const CARD_ICONS: IconComp[] = [
  IconPickaxe,
  IconChart,
  IconSparkles,
  IconUsers,
  IconWallet,
  IconShield,
  IconCoins,
  IconGift,
  IconTrophy,
  IconBrain,
  IconBoltSmall,
  IconSend,
  IconMail,
  IconKey,
  IconCalendar,
  IconTrend,
  IconShare,
  IconEye,
  IconClock,
  IconCopy,
  IconLock,
  IconUser,
  IconGame,
];

/* ============================================================
   Persisted stats
   ============================================================ */

type DifficultyStats = {
  gamesWon: number;
  bestMoves: number; // 0 == unset
  bestTimeMs: number; // 0 == unset
};

type MemoryStats = {
  totalCoins: number;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
};

const EMPTY_DIFF_STATS: DifficultyStats = {
  gamesWon: 0,
  bestMoves: 0,
  bestTimeMs: 0,
};

const EMPTY_STATS: MemoryStats = {
  totalCoins: 0,
  easy: { ...EMPTY_DIFF_STATS },
  medium: { ...EMPTY_DIFF_STATS },
  hard: { ...EMPTY_DIFF_STATS },
};

const STORAGE_KEY = "minero_memory_stats_v1";

function toDiffStats(v: unknown): DifficultyStats {
  if (!v || typeof v !== "object") return { ...EMPTY_DIFF_STATS };
  const o = v as Record<string, unknown>;
  return {
    gamesWon: Number(o.gamesWon) || 0,
    bestMoves: Number(o.bestMoves) || 0,
    bestTimeMs: Number(o.bestTimeMs) || 0,
  };
}

function parseStats(raw: string | null): MemoryStats {
  if (!raw) return EMPTY_STATS;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      easy: toDiffStats(p.easy),
      medium: toDiffStats(p.medium),
      hard: toDiffStats(p.hard),
    };
  } catch {
    return EMPTY_STATS;
  }
}

let cachedRaw: string | null = null;
let cachedStats: MemoryStats = EMPTY_STATS;

function getSnapshot(): MemoryStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = parseStats(raw);
  }
  return cachedStats;
}

function getServerSnapshot(): MemoryStats {
  return EMPTY_STATS;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStats(next: MemoryStats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedStats = parseStats(cachedRaw);
    listeners.forEach((cb) => cb());
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    /* quota / private mode */
  }
}

/* ============================================================
   Board helpers
   ============================================================ */

type Card = {
  id: number;
  pairKey: number;
  icon: IconComp;
  flipped: boolean;
  matched: boolean;
};

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck(pairs: number): Card[] {
  const iconsPool = shuffle(CARD_ICONS).slice(0, pairs);
  const cards: Card[] = [];
  iconsPool.forEach((icon, pairKey) => {
    cards.push({ id: pairKey * 2, pairKey, icon, flipped: false, matched: false });
    cards.push({
      id: pairKey * 2 + 1,
      pairKey,
      icon,
      flipped: false,
      matched: false,
    });
  });
  return shuffle(cards);
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function computeScore(diff: DifficultySpec, moves: number, elapsedMs: number) {
  const timePenalty = Math.floor(elapsedMs / 1000) * SCORE_TIME_PENALTY;
  const raw = SCORE_BASE * diff.multiplier - moves * SCORE_MOVE_PENALTY - timePenalty;
  return Math.max(0, Math.round(raw));
}

/* ============================================================
   Main client
   ============================================================ */

type Status = "idle" | "playing" | "won" | "replay-reveal" | "replay-flipback" | "scatter";

type CoinPopData = { id: number; amount: number };

export default function MemoryClient({ playerName }: { playerName: string }) {
  const router = useRouter();
  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const spec = DIFFICULTIES[difficulty];

  const [cards, setCards] = useState<Card[]>([]);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [secondPick, setSecondPick] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matchesDone, setMatchesDone] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [finalScore, setFinalScore] = useState<number>(0);
  const [finalElapsedMs, setFinalElapsedMs] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseBalanceRef = useRef<number>(0);
  const previewRef = useRef<number>(0); // cumulative provisional coins emitted

  const [scorePops, setScorePops] = useState<CoinPopData[]>([]);
  const popIdRef = useRef<number>(0);
  const [scatterMap, setScatterMap] = useState<Map<number, string>>(new Map());

  const clearFlipTimer = useCallback(() => {
    if (flipTimer.current) {
      clearTimeout(flipTimer.current);
      flipTimer.current = null;
    }
  }, []);

  // Countdown tick while playing
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => () => clearFlipTimer(), [clearFlipTimer]);

  const resetBoard = useCallback(
    (targetDiff: Difficulty) => {
      clearFlipTimer();
      sessionIdRef.current = null;
      baseBalanceRef.current = 0;
      previewRef.current = 0;
      const next = DIFFICULTIES[targetDiff];
      setDifficulty(targetDiff);
      setCards(buildDeck(next.pairs));
      setFirstPick(null);
      setSecondPick(null);
      setLocked(false);
      setMoves(0);
      setMatchesDone(0);
      setStartedAt(null);
      setStatus("idle");
      setFinalScore(0);
      setFinalElapsedMs(0);
      setScorePops([]);
      setScatterMap(new Map());
    },
    [clearFlipTimer],
  );

  // Client-only initial deck: server renders an empty board (no Math.random
  // on the server), then on the first client render we seed the deck. Calling
  // setState conditionally during render for the current component is a
  // supported React pattern and keeps the initial paint hydration-stable.
  if (!hydrated && typeof window !== "undefined") {
    setHydrated(true);
    setCards(buildDeck(DIFFICULTIES[difficulty].pairs));
  }

  const finishGame = useCallback(
    (elapsedMs: number, movesUsed: number) => {
      const score = computeScore(spec, movesUsed, elapsedMs);
      setFinalScore(score);
      setFinalElapsedMs(elapsedMs);
      setStatus("won");

      const prev = getSnapshot();
      const prevDiff = prev[difficulty];
      const nextDiff: DifficultyStats = {
        gamesWon: prevDiff.gamesWon + 1,
        bestMoves:
          prevDiff.bestMoves === 0
            ? movesUsed
            : Math.min(prevDiff.bestMoves, movesUsed),
        bestTimeMs:
          prevDiff.bestTimeMs === 0
            ? elapsedMs
            : Math.min(prevDiff.bestTimeMs, elapsedMs),
      };
      writeStats({
        ...prev,
        totalCoins: prev.totalCoins + score,
        [difficulty]: nextDiff,
      });
      if (sessionIdRef.current) {
        const sid = sessionIdRef.current;
        sessionIdRef.current = null;
        finishGameSession(sid, score).then((r) => {
          if (!r.ok) emitBalanceChange();
        });
      } else {
        emitBalanceChange();
      }
    },
    [difficulty, spec],
  );

  const handlePick = useCallback(
    (cardId: number) => {
      if (
        locked ||
        status === "won" ||
        status === "replay-reveal" ||
        status === "replay-flipback" ||
        status === "scatter"
      )
        return;
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.flipped || card.matched) return;

      // First interaction starts the timer and the server session.
      if (status === "idle") {
        setStartedAt(Date.now());
        setNow(Date.now());
        setStatus("playing");
        Promise.all([startGameSession("memory"), getGameBalance()]).then(
          ([sessionResult, balResult]) => {
            if (sessionResult.ok) sessionIdRef.current = sessionResult.sessionId;
            baseBalanceRef.current = balResult?.balance ?? 0;
          },
        );
      }

      // Reveal the card.
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, flipped: true } : c)),
      );

      if (firstPick === null) {
        setFirstPick(cardId);
        return;
      }

      if (secondPick !== null) return; // should not happen — safety

      setSecondPick(cardId);
      setLocked(true);
      const nextMoves = moves + 1;
      setMoves(nextMoves);

      const a = cards.find((c) => c.id === firstPick);
      const b = card;
      if (a && b && a.pairKey === b.pairKey) {
        // Match — mark matched, clear picks.
        setCards((prev) =>
          prev.map((c) =>
            c.pairKey === a.pairKey ? { ...c, flipped: true, matched: true } : c,
          ),
        );
        const nextMatches = matchesDone + 1;
        setMatchesDone(nextMatches);
        setFirstPick(null);
        setSecondPick(null);
        setLocked(false);

        // Provisional live coin update for this match.
        const elapsed = Date.now() - (startedAt ?? Date.now());
        const newScore = computeScore(spec, nextMoves, elapsed);
        const newPreview = previewCoins(newScore);
        const delta = Math.max(0, newPreview - previewRef.current);
        previewRef.current = newPreview;
        emitBalanceChange(baseBalanceRef.current + newPreview);

        if (delta > 0) {
          const popId = ++popIdRef.current;
          setScorePops((prev) => [...prev, { id: popId, amount: delta }]);
          setTimeout(() => {
            setScorePops((prev) => prev.filter((p) => p.id !== popId));
          }, 1200);
        }

        if (nextMatches >= spec.pairs) {
          finishGame(elapsed, nextMoves);
        }
        return;
      }

      // Mismatch — briefly show both, then flip back.
      flipTimer.current = setTimeout(() => {
        setCards((prev) =>
          prev.map((c) =>
            (c.id === firstPick || c.id === cardId) && !c.matched
              ? { ...c, flipped: false }
              : c,
          ),
        );
        setFirstPick(null);
        setSecondPick(null);
        setLocked(false);
      }, FLIP_BACK_MS);
    },
    [cards, firstPick, secondPick, locked, moves, matchesDone, spec, startedAt, status, finishGame],
  );

  const handlePlayAgain = useCallback(() => {
    // Phase 1: reveal all cards face-up with icons (not checkmarks).
    setCards((prev) => prev.map((c) => ({ ...c, flipped: true, matched: false })));
    setStatus("replay-reveal");
    setTimeout(() => {
      // Phase 2: flip all face-down.
      setCards((prev) => prev.map((c) => ({ ...c, flipped: false })));
      setStatus("replay-flipback");
      setTimeout(() => {
        resetBoard(difficulty);
      }, 700);
    }, 700);
  }, [difficulty, resetBoard]);

  const handleQuit = useCallback(() => {
    const map = new Map<number, string>();
    cards.forEach((card) => {
      const dx = (Math.random() - 0.5) * 900;
      const dy = (Math.random() - 0.5) * 700;
      const rot = (Math.random() - 0.5) * 300;
      map.set(card.id, `translate(${dx}px, ${dy}px) rotate(${rot}deg)`);
    });
    setScatterMap(map);
    setStatus("scatter");
    setTimeout(() => router.push("/game"), 600);
  }, [cards, router]);

  const replay = () => resetBoard(difficulty);

  const elapsedMs =
    status === "won" || status === "replay-reveal" || status === "replay-flipback"
      ? finalElapsedMs
      : startedAt
        ? now - startedAt
        : 0;

  const currentDiffStats = stats[difficulty];
  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const finalCoins = previewCoins(finalScore);

  const boardDisabled =
    locked ||
    status === "won" ||
    status === "replay-reveal" ||
    status === "replay-flipback" ||
    status === "scatter";

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 lg:px-8 lg:py-8">
      {/* Inject keyframe for coin pop animation */}
      <style>{`
        @keyframes memCoinPop {
          0%   { opacity: 1; transform: translate(-50%, 0px) scale(1); }
          60%  { opacity: 1; transform: translate(-50%, -45px) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -80px) scale(0.9); }
        }
      `}</style>

      <header className="mb-5 lg:mb-7">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Memory Match
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Flip two cards at a time. Match every pair with as few moves as possible
          — the faster you finish, the more game coins you earn.
        </p>
      </header>

      {/* Difficulty switcher */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => {
          const s = DIFFICULTIES[d];
          const active = d === difficulty;
          return (
            <button
              key={d}
              type="button"
              onClick={() => resetBoard(d)}
              className="btn btn-sm"
              aria-pressed={active}
              style={{
                background: active ? "var(--brand-weak)" : "var(--surface-2)",
                color: active ? "var(--brand-weak-fg)" : "var(--text)",
                borderColor: active
                  ? "color-mix(in oklab, var(--brand) 40%, transparent)"
                  : "var(--border)",
              }}
            >
              {s.label}
              <span
                className="ml-1 text-xs font-mono"
                style={{ color: "var(--text-subtle)" }}
              >
                {s.pairs}×2
              </span>
            </button>
          );
        })}
        <span
          className="ml-auto text-xs hidden md:inline"
          style={{ color: "var(--text-subtle)" }}
        >
          Difficulty multiplier: ×{spec.multiplier}
        </span>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Moves</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {moves}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Time</span>
          <span
            className="kpi-value"
            style={{
              fontSize: "var(--fs-20)",
              fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
            }}
          >
            {formatTime(elapsedMs)}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Best moves ({spec.label})</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {currentDiffStats.bestMoves || "—"}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Best time ({spec.label})</span>
          <span
            className="kpi-value"
            style={{
              fontSize: "var(--fs-20)",
              fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
            }}
          >
            {currentDiffStats.bestTimeMs
              ? formatTime(currentDiffStats.bestTimeMs)
              : "—"}
          </span>
        </div>
      </div>

      {/* Game-over overlay */}
      {status === "won" && (
        <GameOverOverlay
          score={finalScore}
          coins={finalCoins}
          moves={moves}
          elapsedMs={finalElapsedMs}
          firstName={firstName}
          onPlayAgain={handlePlayAgain}
          onQuit={handleQuit}
        />
      )}

      {/* Board with coin pop overlay */}
      <div className="relative">
        {scorePops.map((pop) => (
          <CoinPop key={pop.id} amount={pop.amount} />
        ))}
        <Board
          cards={cards}
          cols={spec.cols}
          rows={spec.rows}
          disabled={boardDisabled}
          onPick={handlePick}
          scatterMap={scatterMap}
        />
      </div>

      {/* Footer actions */}
      <div className="mt-5 flex items-center justify-between text-xs" style={{ color: "var(--text-subtle)" }}>
        <div className="flex items-center gap-1.5">
          <IconSparkles size={14} />
          Score = {SCORE_BASE} × multiplier − moves × {SCORE_MOVE_PENALTY} − seconds × {SCORE_TIME_PENALTY}
        </div>
        <button type="button" onClick={replay} className="btn btn-ghost btn-sm">
          Shuffle new board
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Board
   ============================================================ */

function Board({
  cards,
  cols,
  rows,
  disabled,
  onPick,
  scatterMap,
}: {
  cards: Card[];
  cols: number;
  rows: number;
  disabled: boolean;
  onPick: (id: number) => void;
  scatterMap: Map<number, string>;
}) {
  const style = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gridAutoRows: "1fr",
      gap: "0.5rem",
    }),
    [cols],
  );

  return (
    <div
      className="surface p-3 lg:p-4"
      style={{ borderRadius: "var(--radius-lg)" }}
      aria-label="Memory match board"
      role="grid"
    >
      <div style={style} aria-rowcount={rows} aria-colcount={cols}>
        {cards.map((c) => (
          <div
            key={c.id}
            style={{
              transform: scatterMap.get(c.id) ?? "none",
              transition: scatterMap.size > 0
                ? "transform 0.55s cubic-bezier(0.4, 0, 0.8, 0.5)"
                : undefined,
              transformOrigin: "center",
              willChange: scatterMap.size > 0 ? "transform" : undefined,
            }}
          >
            <CardButton
              card={c}
              disabled={disabled || c.flipped || c.matched}
              onPick={onPick}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Card
   ============================================================ */

function CardButton({
  card,
  disabled,
  onPick,
}: {
  card: Card;
  disabled: boolean;
  onPick: (id: number) => void;
}) {
  const showFace = card.flipped || card.matched;
  const Icon = card.icon;

  return (
    <button
      type="button"
      onClick={() => onPick(card.id)}
      disabled={disabled}
      aria-label={showFace ? `Card ${card.pairKey + 1}` : "Hidden card"}
      aria-pressed={showFace}
      className="relative block focus:outline-none"
      style={{
        perspective: "1000px",
        aspectRatio: "1 / 1",
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: disabled && !showFace ? "default" : "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: showFace ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 420ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Back (hidden face) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: "var(--radius-md)",
            background:
              "linear-gradient(135deg, var(--surface-2), var(--surface-3))",
            border: "1px solid var(--border-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--brand)",
            boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--brand) 20%, transparent)",
          }}
        >
          <IconBrain size={22} />
        </div>

        {/* Front (revealed face) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: "var(--radius-md)",
            background: card.matched ? "var(--success-weak)" : "var(--brand-weak)",
            border: `1px solid ${
              card.matched
                ? "color-mix(in oklab, var(--success) 45%, transparent)"
                : "color-mix(in oklab, var(--brand) 40%, transparent)"
            }`,
            color: card.matched ? "var(--success-fg)" : "var(--brand-weak-fg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {card.matched ? (
            <IconCheck size={28} />
          ) : (
            <Icon size={28} />
          )}
        </div>
      </div>
    </button>
  );
}

/* ============================================================
   Coin pop animation
   ============================================================ */

function CoinPop({ amount }: { amount: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "20%",
        left: "50%",
        zIndex: 50,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontWeight: 700,
        fontSize: "1.05rem",
        color: "var(--brand)",
        filter: "drop-shadow(0 1px 4px color-mix(in oklab, var(--brand) 60%, transparent))",
        animation: "memCoinPop 1.2s ease-out forwards",
        whiteSpace: "nowrap",
      }}
    >
      <IconCoin size={16} />+{amount}
    </div>
  );
}

/* ============================================================
   Game-over overlay
   ============================================================ */

function GameOverOverlay({
  score,
  coins,
  moves,
  elapsedMs,
  firstName,
  onPlayAgain,
  onQuit,
}: {
  score: number;
  coins: number;
  moves: number;
  elapsedMs: number;
  firstName: string;
  onPlayAgain: () => void;
  onQuit: () => void;
}) {
  return (
    <section
      className="card mb-5"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--brand-weak) 75%, transparent), var(--surface))",
      }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <span
          aria-hidden
          className="inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0"
          style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
        >
          <IconTrophy size={22} />
        </span>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg">Nice work, {firstName}!</h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Cleared in <strong>{moves}</strong> moves · <strong>{formatTime(elapsedMs)}</strong>
          </p>
        </div>

        {/* Coins earned (primary) */}
        <div
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 shrink-0"
          style={{
            background: "var(--brand-weak)",
            border: "1px solid color-mix(in oklab, var(--brand) 35%, transparent)",
          }}
        >
          <IconCoin size={20} style={{ color: "var(--brand)" }} />
          <div>
            <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
              You got
            </div>
            <div
              className="font-mono font-bold leading-tight"
              style={{ fontSize: "var(--fs-24)", color: "var(--brand)" }}
            >
              {coins} total coins
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={onQuit}
          className="btn btn-ghost btn-sm"
        >
          Quit game
        </button>
        <button
          type="button"
          onClick={onPlayAgain}
          className="btn btn-primary"
        >
          Play again
          <IconArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
