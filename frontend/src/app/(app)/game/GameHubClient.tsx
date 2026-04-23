"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  IconArrowRight,
  IconBrain,
  IconClock,
  IconCoin,
  IconCopy,
  IconGame,
  IconGift,
  IconMine,
  IconSparkles,
  IconTrophy,
} from "@/components/icons";

/* ============================================================
   Shared stats readers (mirrors per-game stores)
   ============================================================ */

const TRIVIA_KEY = "minero_trivia_stats_v1";
const SPIN_KEY = "minero_spin_stats_v1";
const MEMORY_KEY = "minero_memory_stats_v1";
const MINESWEEPER_KEY = "minero_minesweeper_stats_v1";
const WORD_KEY = "minero_word_stats_v1";
const SNAKE_KEY = "minero_snake_stats_v1";
const BLOCKBLAST_KEY = "minero_blockblast_stats_v1";
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type TriviaStats = {
  bestScore: number;
  totalCoins: number;
  gamesPlayed: number;
  totalCorrect: number;
};

type SpinStats = {
  lastSpinAt: number;
  lastPrize: number;
  totalCoins: number;
  spinsCompleted: number;
};

type DiffStats = {
  gamesWon: number;
  bestMoves: number;
  bestTimeMs: number;
};

type MemoryStats = {
  totalCoins: number;
  easy: DiffStats;
  medium: DiffStats;
  hard: DiffStats;
};

type MinesweeperDiff = {
  gamesWon: number;
  bestTimeMs: number;
};

type MinesweeperStats = {
  totalCoins: number;
  easy: MinesweeperDiff;
  medium: MinesweeperDiff;
  hard: MinesweeperDiff;
};

const EMPTY_TRIVIA: TriviaStats = {
  bestScore: 0,
  totalCoins: 0,
  gamesPlayed: 0,
  totalCorrect: 0,
};

const EMPTY_SPIN: SpinStats = {
  lastSpinAt: 0,
  lastPrize: 0,
  totalCoins: 0,
  spinsCompleted: 0,
};

const EMPTY_DIFF: DiffStats = { gamesWon: 0, bestMoves: 0, bestTimeMs: 0 };

const EMPTY_MEMORY: MemoryStats = {
  totalCoins: 0,
  easy: { ...EMPTY_DIFF },
  medium: { ...EMPTY_DIFF },
  hard: { ...EMPTY_DIFF },
};

const EMPTY_SWEEP_DIFF: MinesweeperDiff = { gamesWon: 0, bestTimeMs: 0 };
const EMPTY_MINESWEEPER: MinesweeperStats = {
  totalCoins: 0,
  easy: { ...EMPTY_SWEEP_DIFF },
  medium: { ...EMPTY_SWEEP_DIFF },
  hard: { ...EMPTY_SWEEP_DIFF },
};

type WordStats = {
  totalCoins: number;
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDay: number;
  lastResult: "win" | "loss" | null;
};

const EMPTY_WORD: WordStats = {
  totalCoins: 0,
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDay: -1,
  lastResult: null,
};

type SnakeStats = {
  totalCoins: number;
  bestScore: number;
  gamesPlayed: number;
  applesEaten: number;
};

const EMPTY_SNAKE: SnakeStats = {
  totalCoins: 0,
  bestScore: 0,
  gamesPlayed: 0,
  applesEaten: 0,
};

type BlockBlastStats = {
  totalCoins: number;
  bestScore: number;
  gamesPlayed: number;
  linesCleared: number;
};

const EMPTY_BLOCKBLAST: BlockBlastStats = {
  totalCoins: 0,
  bestScore: 0,
  gamesPlayed: 0,
  linesCleared: 0,
};

function parseTrivia(raw: string | null): TriviaStats {
  if (!raw) return EMPTY_TRIVIA;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      bestScore: Number(p.bestScore) || 0,
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      totalCorrect: Number(p.totalCorrect) || 0,
    };
  } catch {
    return EMPTY_TRIVIA;
  }
}

function parseSpin(raw: string | null): SpinStats {
  if (!raw) return EMPTY_SPIN;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      lastSpinAt: Number(p.lastSpinAt) || 0,
      lastPrize: Number(p.lastPrize) || 0,
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      spinsCompleted: Number(p.spinsCompleted) || 0,
    };
  } catch {
    return EMPTY_SPIN;
  }
}

function parseDiff(v: unknown): DiffStats {
  if (!v || typeof v !== "object") return { ...EMPTY_DIFF };
  const o = v as Record<string, unknown>;
  return {
    gamesWon: Number(o.gamesWon) || 0,
    bestMoves: Number(o.bestMoves) || 0,
    bestTimeMs: Number(o.bestTimeMs) || 0,
  };
}

function parseMemory(raw: string | null): MemoryStats {
  if (!raw) return EMPTY_MEMORY;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      easy: parseDiff(p.easy),
      medium: parseDiff(p.medium),
      hard: parseDiff(p.hard),
    };
  } catch {
    return EMPTY_MEMORY;
  }
}

function parseSweepDiff(v: unknown): MinesweeperDiff {
  if (!v || typeof v !== "object") return { ...EMPTY_SWEEP_DIFF };
  const o = v as Record<string, unknown>;
  return {
    gamesWon: Number(o.gamesWon) || 0,
    bestTimeMs: Number(o.bestTimeMs) || 0,
  };
}

function parseMinesweeper(raw: string | null): MinesweeperStats {
  if (!raw) return EMPTY_MINESWEEPER;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      easy: parseSweepDiff(p.easy),
      medium: parseSweepDiff(p.medium),
      hard: parseSweepDiff(p.hard),
    };
  } catch {
    return EMPTY_MINESWEEPER;
  }
}

function parseWord(raw: string | null): WordStats {
  if (!raw) return EMPTY_WORD;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      wins: Number(p.wins) || 0,
      currentStreak: Number(p.currentStreak) || 0,
      bestStreak: Number(p.bestStreak) || 0,
      lastPlayedDay:
        typeof p.lastPlayedDay === "number" && Number.isFinite(p.lastPlayedDay)
          ? p.lastPlayedDay
          : -1,
      lastResult:
        p.lastResult === "win" || p.lastResult === "loss" ? p.lastResult : null,
    };
  } catch {
    return EMPTY_WORD;
  }
}

function parseSnake(raw: string | null): SnakeStats {
  if (!raw) return EMPTY_SNAKE;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      bestScore: Number(p.bestScore) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      applesEaten: Number(p.applesEaten) || 0,
    };
  } catch {
    return EMPTY_SNAKE;
  }
}

function parseBlockBlast(raw: string | null): BlockBlastStats {
  if (!raw) return EMPTY_BLOCKBLAST;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      bestScore: Number(p.bestScore) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      linesCleared: Number(p.linesCleared) || 0,
    };
  } catch {
    return EMPTY_BLOCKBLAST;
  }
}

// Per-key raw+parsed cache so useSyncExternalStore returns stable references.
let triviaRaw: string | null = null;
let triviaCache: TriviaStats = EMPTY_TRIVIA;
let spinRaw: string | null = null;
let spinCache: SpinStats = EMPTY_SPIN;
let memoryRaw: string | null = null;
let memoryCache: MemoryStats = EMPTY_MEMORY;
let sweepRaw: string | null = null;
let sweepCache: MinesweeperStats = EMPTY_MINESWEEPER;
let wordRaw: string | null = null;
let wordCache: WordStats = EMPTY_WORD;
let snakeRaw: string | null = null;
let snakeCache: SnakeStats = EMPTY_SNAKE;
let bbRaw: string | null = null;
let bbCache: BlockBlastStats = EMPTY_BLOCKBLAST;

function getTriviaSnapshot(): TriviaStats {
  if (typeof window === "undefined") return EMPTY_TRIVIA;
  const raw = window.localStorage.getItem(TRIVIA_KEY);
  if (raw !== triviaRaw) {
    triviaRaw = raw;
    triviaCache = parseTrivia(raw);
  }
  return triviaCache;
}

function getSpinSnapshot(): SpinStats {
  if (typeof window === "undefined") return EMPTY_SPIN;
  const raw = window.localStorage.getItem(SPIN_KEY);
  if (raw !== spinRaw) {
    spinRaw = raw;
    spinCache = parseSpin(raw);
  }
  return spinCache;
}

function getMemorySnapshot(): MemoryStats {
  if (typeof window === "undefined") return EMPTY_MEMORY;
  const raw = window.localStorage.getItem(MEMORY_KEY);
  if (raw !== memoryRaw) {
    memoryRaw = raw;
    memoryCache = parseMemory(raw);
  }
  return memoryCache;
}

function getMinesweeperSnapshot(): MinesweeperStats {
  if (typeof window === "undefined") return EMPTY_MINESWEEPER;
  const raw = window.localStorage.getItem(MINESWEEPER_KEY);
  if (raw !== sweepRaw) {
    sweepRaw = raw;
    sweepCache = parseMinesweeper(raw);
  }
  return sweepCache;
}

function getWordSnapshot(): WordStats {
  if (typeof window === "undefined") return EMPTY_WORD;
  const raw = window.localStorage.getItem(WORD_KEY);
  if (raw !== wordRaw) {
    wordRaw = raw;
    wordCache = parseWord(raw);
  }
  return wordCache;
}

function getSnakeSnapshot(): SnakeStats {
  if (typeof window === "undefined") return EMPTY_SNAKE;
  const raw = window.localStorage.getItem(SNAKE_KEY);
  if (raw !== snakeRaw) {
    snakeRaw = raw;
    snakeCache = parseSnake(raw);
  }
  return snakeCache;
}

function makeSubscriber(key: string) {
  return (cb: () => void) => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) cb();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  };
}

const subscribeTrivia = makeSubscriber(TRIVIA_KEY);
const getTriviaServer = () => EMPTY_TRIVIA;

const subscribeSpin = makeSubscriber(SPIN_KEY);
const getSpinServer = () => EMPTY_SPIN;

const subscribeMemory = makeSubscriber(MEMORY_KEY);
const getMemoryServer = () => EMPTY_MEMORY;

const subscribeMinesweeper = makeSubscriber(MINESWEEPER_KEY);
const getMinesweeperServer = () => EMPTY_MINESWEEPER;

const subscribeWord = makeSubscriber(WORD_KEY);
const getWordServer = () => EMPTY_WORD;

const subscribeSnake = makeSubscriber(SNAKE_KEY);
const getSnakeServer = () => EMPTY_SNAKE;

function getBlockBlastSnapshot(): BlockBlastStats {
  if (typeof window === "undefined") return EMPTY_BLOCKBLAST;
  const raw = window.localStorage.getItem(BLOCKBLAST_KEY);
  if (raw !== bbRaw) { bbRaw = raw; bbCache = parseBlockBlast(raw); }
  return bbCache;
}
const subscribeBlockBlast = makeSubscriber(BLOCKBLAST_KEY);
const getBlockBlastServer = () => EMPTY_BLOCKBLAST;

function formatCountdown(ms: number) {
  if (ms <= 0) return "Ready";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatTimeShort(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ============================================================
   Hub
   ============================================================ */

export default function GameHubClient({ playerName }: { playerName: string }) {
  const trivia = useSyncExternalStore(
    subscribeTrivia,
    getTriviaSnapshot,
    getTriviaServer,
  );
  const spin = useSyncExternalStore(
    subscribeSpin,
    getSpinSnapshot,
    getSpinServer,
  );
  const memory = useSyncExternalStore(
    subscribeMemory,
    getMemorySnapshot,
    getMemoryServer,
  );
  const sweep = useSyncExternalStore(
    subscribeMinesweeper,
    getMinesweeperSnapshot,
    getMinesweeperServer,
  );
  const word = useSyncExternalStore(
    subscribeWord,
    getWordSnapshot,
    getWordServer,
  );
  const snake = useSyncExternalStore(
    subscribeSnake,
    getSnakeSnapshot,
    getSnakeServer,
  );
  const blockblast = useSyncExternalStore(
    subscribeBlockBlast,
    getBlockBlastSnapshot,
    getBlockBlastServer,
  );

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const spinCooldown = spin.lastSpinAt
    ? Math.max(0, spin.lastSpinAt + SPIN_COOLDOWN_MS - now)
    : 0;
  const spinReady = spinCooldown === 0;

  const memoryWins =
    memory.easy.gamesWon + memory.medium.gamesWon + memory.hard.gamesWon;
  const sweepWins =
    sweep.easy.gamesWon + sweep.medium.gamesWon + sweep.hard.gamesWon;
  const sweepEasyBest = sweep.easy.bestTimeMs;

  // Word: daily challenge. "Done today" = last played day matches today.
  const todayDay = Math.floor(now / DAY_MS);
  const wordDoneToday = word.lastPlayedDay === todayDay;
  const wordNextMs = Math.max(0, (todayDay + 1) * DAY_MS - now);

  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const totalGameCoins =
    trivia.totalCoins +
    spin.totalCoins +
    memory.totalCoins +
    sweep.totalCoins +
    word.totalCoins +
    snake.totalCoins +
    blockblast.totalCoins;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 lg:mb-8">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Games
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Hi {firstName} — pick a game. Your scores stack up across them.
        </p>
      </header>

      {/* Combined stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="kpi">
          <span className="kpi-label">Total game coins</span>
          <span className="kpi-value kpi-value-brand flex items-center gap-1">
            <IconCoin size={16} />
            {totalGameCoins}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Trivia best score</span>
          <span className="kpi-value">{trivia.bestScore}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Spins completed</span>
          <span className="kpi-value">{spin.spinsCompleted}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Next free spin</span>
          <span
            className="kpi-value"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
              fontSize: "var(--fs-20)",
              color: spinReady ? "var(--success-fg)" : "var(--text)",
            }}
          >
            {formatCountdown(spinCooldown)}
          </span>
        </div>
      </div>

      {/* Redeem rewards CTA */}
      <Link
        href="/rewards"
        className="card card-hover mb-6 flex items-center gap-3"
        style={{
          background:
            "linear-gradient(165deg, color-mix(in oklab, var(--brand-weak) 60%, transparent), var(--surface))",
        }}
      >
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
        >
          <IconGift size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-base md:text-lg font-semibold leading-snug">
            Redeem rewards
          </div>
          <div className="text-xs md:text-sm" style={{ color: "var(--text-muted)" }}>
            Convert your coins into peso-value cards · 2,499 coins = ₱1
          </div>
        </div>
        <span
          className="text-sm font-semibold shrink-0"
          style={{ color: "var(--brand)" }}
        >
          Open →
        </span>
      </Link>

      {/* Game list — compact rows on mobile, full cards on md+ */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <GameCard
          href="/game/trivia"
          title="Trivia Quiz"
          tagline="Answer fast, build streaks"
          description="10 questions across mixed categories. Speed bonuses and streak multipliers boost your score."
          icon={<IconBrain size={22} />}
          status={
            trivia.gamesPlayed > 0
              ? `Best ${trivia.bestScore} · ${trivia.gamesPlayed} played`
              : "New — give it a try"
          }
          ctaLabel="Play Trivia"
          accent="brand"
        />
        <GameCard
          href="/game/spin"
          title="Daily Spin"
          tagline="Free spin every 24h"
          description="Give the wheel a whirl once a day for up to 250 free game coins. No skill required."
          icon={<IconGift size={22} />}
          status={
            spinReady
              ? spin.spinsCompleted > 0
                ? `Ready — last win +${spin.lastPrize}`
                : "Ready — your first spin awaits"
              : `Next spin in ${formatCountdown(spinCooldown)}`
          }
          statusIcon={spinReady ? <IconSparkles size={14} /> : <IconClock size={14} />}
          ctaLabel={spinReady ? "Spin now" : "View wheel"}
          accent={spinReady ? "success" : "muted"}
        />

        <GameCard
          href="/game/memory"
          title="Memory Match"
          tagline="Flip-and-match card game"
          description="Pair up the cards with as few moves as possible. Three difficulty tiers, scored on moves + time."
          icon={<IconCopy size={22} />}
          status={
            memoryWins > 0
              ? `${memoryWins} cleared${
                  memory.easy.bestMoves
                    ? ` · Easy best ${memory.easy.bestMoves}`
                    : ""
                }`
              : "New — start on Easy"
          }
          ctaLabel="Play Memory"
          accent="brand"
        />
        <GameCard
          href="/game/minesweeper"
          title="Minesweeper"
          tagline="Clear the board, dodge the mines"
          description="Classic logic puzzle. Flag mines, reveal safe cells. Harder difficulties pay out more coins."
          icon={<IconMine size={22} />}
          status={
            sweepWins > 0
              ? `${sweepWins} cleared${
                  sweepEasyBest
                    ? ` · Easy best ${formatTimeShort(sweepEasyBest)}`
                    : ""
                }`
              : "New — first click is always safe"
          }
          ctaLabel="Play Minesweeper"
          accent="brand"
        />

        <GameCard
          href="/game/word"
          title="Word Game"
          tagline="Daily 5-letter puzzle"
          description="Guess the day's word in six tries. Fewer tries earn bigger payouts. One word per day."
          icon={<IconBrain size={22} />}
          status={
            wordDoneToday
              ? word.lastResult === "win"
                ? `Solved today · next in ${formatCountdown(wordNextMs)}`
                : `Missed today · next in ${formatCountdown(wordNextMs)}`
              : word.gamesPlayed > 0
                ? `Streak ${word.currentStreak} · best ${word.bestStreak}`
                : "New — today's word is waiting"
          }
          statusIcon={wordDoneToday ? <IconClock size={14} /> : undefined}
          ctaLabel={wordDoneToday ? "View result" : "Play today"}
          accent={wordDoneToday ? "muted" : "brand"}
        />
        <GameCard
          href="/game/snake"
          title="Snake"
          tagline="Arcade classic on a canvas"
          description="Eat apples, grow longer, don't hit a wall or yourself. Score = apples × 10."
          icon={<IconGame size={22} />}
          status={
            snake.gamesPlayed > 0
              ? `Best ${snake.bestScore} · ${snake.gamesPlayed} played`
              : "New — arrows / swipe to play"
          }
          ctaLabel="Play Snake"
          accent="brand"
        />
        <GameCard
          href="/game/blockblast"
          title="Block Blast"
          tagline="Place blocks, clear lines"
          description="Drop pieces onto an 8×8 grid. Fill complete rows or columns to clear them. Game ends when no piece fits."
          icon={<IconGame size={22} />}
          status={
            blockblast.gamesPlayed > 0
              ? `Best ${blockblast.bestScore} · ${blockblast.gamesPlayed} played`
              : "New — tap a piece to start"
          }
          ctaLabel="Play Block Blast"
          accent="brand"
        />
      </div>

      {/* Footer */}
      <div
        className="mt-8 flex items-center gap-2 text-xs"
        style={{ color: "var(--text-subtle)" }}
      >
        <IconCoin size={14} />
        Game coins are tracked locally on this device.
      </div>
    </div>
  );
}

/* ============================================================
   Cards
   ============================================================ */

type Accent = "brand" | "success" | "muted";

function GameCard({
  href,
  title,
  tagline,
  description,
  icon,
  status,
  statusIcon,
  ctaLabel,
  accent,
}: {
  href: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  status: string;
  statusIcon?: React.ReactNode;
  ctaLabel: string;
  accent: Accent;
}) {
  const statusColor =
    accent === "success"
      ? "var(--success-fg)"
      : accent === "brand"
        ? "var(--brand)"
        : "var(--text-muted)";

  return (
    <Link
      href={href}
      className="card card-hover flex flex-col gap-3"
      style={{
        background:
          "linear-gradient(165deg, color-mix(in oklab, var(--brand-weak) 45%, transparent), var(--surface))",
      }}
    >
      <div className="flex items-center gap-3 md:items-start">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-semibold leading-snug truncate">
            {title}
          </h2>
          <div
            className="text-xs truncate"
            style={{ color: "var(--text-subtle)" }}
          >
            {tagline}
          </div>
          {/* Inline status on mobile (keeps row compact & scannable) */}
          <span
            className="md:hidden mt-1 text-xs font-medium inline-flex items-center gap-1.5 min-w-0"
            style={{ color: statusColor }}
          >
            {statusIcon}
            <span className="truncate">{status}</span>
          </span>
        </div>
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <IconArrowRight size={14} />
        </span>
      </div>
      {/* Description & footer: only on md+ — mobile stays a compact row */}
      <p
        className="hidden md:block text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        {description}
      </p>
      <div className="hidden md:flex mt-auto items-center justify-between pt-1">
        <span
          className="text-xs font-medium inline-flex items-center gap-1.5"
          style={{ color: statusColor }}
        >
          {statusIcon}
          {status}
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--brand)" }}
        >
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}

