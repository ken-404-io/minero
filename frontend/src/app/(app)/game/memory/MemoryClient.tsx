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
import {
  IconArrowRight,
  IconBrain,
  IconBoltSmall,
  IconCalendar,
  IconChart,
  IconCheck,
  IconClock,
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
  totalPoints: number;
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
  totalPoints: 0,
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
      totalPoints: Number(p.totalPoints) || 0,
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

type Status = "idle" | "playing" | "won";

export default function MemoryClient({ playerName }: { playerName: string }) {
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

  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        totalPoints: prev.totalPoints + score,
        [difficulty]: nextDiff,
      });
    },
    [difficulty, spec],
  );

  const handlePick = useCallback(
    (cardId: number) => {
      if (locked || status === "won") return;
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.flipped || card.matched) return;

      // First interaction starts the timer.
      if (status === "idle") {
        setStartedAt(Date.now());
        setNow(Date.now());
        setStatus("playing");
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

        if (nextMatches >= spec.pairs) {
          const elapsed = Date.now() - (startedAt ?? Date.now());
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

  const replay = () => resetBoard(difficulty);

  const elapsedMs =
    status === "won"
      ? finalElapsedMs
      : startedAt
        ? now - startedAt
        : 0;

  const currentDiffStats = stats[difficulty];
  const firstName = playerName?.split(/\s+/)[0] || "Miner";

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-5 lg:mb-7">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Memory Match
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Flip two cards at a time. Match every pair with as few moves as possible
          — the faster you finish, the more game points you earn.
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

      {/* Win banner */}
      {status === "won" && (
        <WinBanner
          score={finalScore}
          moves={moves}
          elapsedMs={finalElapsedMs}
          firstName={firstName}
          onReplay={replay}
        />
      )}

      {/* Board */}
      <Board
        cards={cards}
        cols={spec.cols}
        rows={spec.rows}
        disabled={locked || status === "won"}
        onPick={handlePick}
      />

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
}: {
  cards: Card[];
  cols: number;
  rows: number;
  disabled: boolean;
  onPick: (id: number) => void;
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
          <CardButton
            key={c.id}
            card={c}
            disabled={disabled || c.flipped || c.matched}
            onPick={onPick}
          />
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
   Win banner
   ============================================================ */

function WinBanner({
  score,
  moves,
  elapsedMs,
  firstName,
  onReplay,
}: {
  score: number;
  moves: number;
  elapsedMs: number;
  firstName: string;
  onReplay: () => void;
}) {
  return (
    <section
      className="card mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--brand-weak) 75%, transparent), var(--surface))",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0"
        style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
      >
        <IconTrophy size={22} />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-lg">Nice work, {firstName}!</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Cleared the board in <strong>{moves}</strong> moves ·{" "}
          <strong>{formatTime(elapsedMs)}</strong>.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Points earned
          </div>
          <div
            className="font-mono font-bold"
            style={{ fontSize: "var(--fs-24)", color: "var(--brand)" }}
          >
            +{score}
          </div>
        </div>
        <button onClick={onReplay} className="btn btn-primary">
          Play again
          <IconArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
