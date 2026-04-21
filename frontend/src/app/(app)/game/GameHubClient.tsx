"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  IconArrowRight,
  IconBrain,
  IconClock,
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
const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type TriviaStats = {
  bestScore: number;
  totalPoints: number;
  gamesPlayed: number;
  totalCorrect: number;
};

type SpinStats = {
  lastSpinAt: number;
  lastPrize: number;
  totalPoints: number;
  spinsCompleted: number;
};

type DiffStats = {
  gamesWon: number;
  bestMoves: number;
  bestTimeMs: number;
};

type MemoryStats = {
  totalPoints: number;
  easy: DiffStats;
  medium: DiffStats;
  hard: DiffStats;
};

type MinesweeperDiff = {
  gamesWon: number;
  bestTimeMs: number;
};

type MinesweeperStats = {
  totalPoints: number;
  easy: MinesweeperDiff;
  medium: MinesweeperDiff;
  hard: MinesweeperDiff;
};

const EMPTY_TRIVIA: TriviaStats = {
  bestScore: 0,
  totalPoints: 0,
  gamesPlayed: 0,
  totalCorrect: 0,
};

const EMPTY_SPIN: SpinStats = {
  lastSpinAt: 0,
  lastPrize: 0,
  totalPoints: 0,
  spinsCompleted: 0,
};

const EMPTY_DIFF: DiffStats = { gamesWon: 0, bestMoves: 0, bestTimeMs: 0 };

const EMPTY_MEMORY: MemoryStats = {
  totalPoints: 0,
  easy: { ...EMPTY_DIFF },
  medium: { ...EMPTY_DIFF },
  hard: { ...EMPTY_DIFF },
};

const EMPTY_SWEEP_DIFF: MinesweeperDiff = { gamesWon: 0, bestTimeMs: 0 };
const EMPTY_MINESWEEPER: MinesweeperStats = {
  totalPoints: 0,
  easy: { ...EMPTY_SWEEP_DIFF },
  medium: { ...EMPTY_SWEEP_DIFF },
  hard: { ...EMPTY_SWEEP_DIFF },
};

function parseTrivia(raw: string | null): TriviaStats {
  if (!raw) return EMPTY_TRIVIA;
  try {
    const p = JSON.parse(raw) as Partial<TriviaStats>;
    return {
      bestScore: Number(p.bestScore) || 0,
      totalPoints: Number(p.totalPoints) || 0,
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
    const p = JSON.parse(raw) as Partial<SpinStats>;
    return {
      lastSpinAt: Number(p.lastSpinAt) || 0,
      lastPrize: Number(p.lastPrize) || 0,
      totalPoints: Number(p.totalPoints) || 0,
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
      totalPoints: Number(p.totalPoints) || 0,
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
      totalPoints: Number(p.totalPoints) || 0,
      easy: parseSweepDiff(p.easy),
      medium: parseSweepDiff(p.medium),
      hard: parseSweepDiff(p.hard),
    };
  } catch {
    return EMPTY_MINESWEEPER;
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

  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const totalGamePoints =
    trivia.totalPoints +
    spin.totalPoints +
    memory.totalPoints +
    sweep.totalPoints;

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
          <span className="kpi-label">Total game points</span>
          <span className="kpi-value kpi-value-brand">{totalGamePoints}</span>
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
          description="Give the wheel a whirl once a day for up to 250 free game points. No skill required."
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
          description="Classic logic puzzle. Flag mines, reveal safe cells. Harder difficulties pay out more points."
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

        <ComingSoonCard
          title="Word Game"
          description="Wordle-style daily word challenge — 6 tries, one word per day."
        />
        <ComingSoonCard
          title="Snake"
          description="Arcade classic on a canvas. Eat, grow, don't hit the walls."
        />
      </div>

      {/* Footer */}
      <div
        className="mt-8 flex items-center gap-2 text-xs"
        style={{ color: "var(--text-subtle)" }}
      >
        <IconTrophy size={14} />
        Game points are tracked locally on this device.
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

function ComingSoonCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="card flex flex-col gap-3"
      style={{ opacity: 0.7, borderStyle: "dashed" }}
      aria-disabled
    >
      <div className="flex items-center gap-3 md:items-start">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <IconGame size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-semibold leading-snug truncate">
            {title}
          </h2>
          <div
            className="text-xs truncate"
            style={{ color: "var(--text-subtle)" }}
          >
            Coming soon
          </div>
        </div>
      </div>
      {/* Description only on md+ — mobile keeps the row silhouette dense */}
      <p
        className="hidden md:block text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        {description}
      </p>
    </div>
  );
}
