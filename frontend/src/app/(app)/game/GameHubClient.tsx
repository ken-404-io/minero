"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  IconArrowRight,
  IconBrain,
  IconClock,
  IconGame,
  IconGift,
  IconSparkles,
  IconTrophy,
} from "@/components/icons";

/* ============================================================
   Shared stats readers (mirrors per-game stores)
   ============================================================ */

const TRIVIA_KEY = "minero_trivia_stats_v1";
const SPIN_KEY = "minero_spin_stats_v1";
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

// Per-key raw+parsed cache so useSyncExternalStore returns stable references.
let triviaRaw: string | null = null;
let triviaCache: TriviaStats = EMPTY_TRIVIA;
let spinRaw: string | null = null;
let spinCache: SpinStats = EMPTY_SPIN;

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

function formatCountdown(ms: number) {
  if (ms <= 0) return "Ready";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
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

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const spinCooldown = spin.lastSpinAt
    ? Math.max(0, spin.lastSpinAt + SPIN_COOLDOWN_MS - now)
    : 0;
  const spinReady = spinCooldown === 0;

  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const totalGamePoints = trivia.totalPoints + spin.totalPoints;

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

      {/* Game cards */}
      <div className="grid gap-4 md:grid-cols-2">
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

        <ComingSoonCard
          title="Memory Match"
          description="Classic flip-and-match card game. Quick sessions, satisfying payoff."
        />
        <ComingSoonCard
          title="Minesweeper"
          description="Clear the board, earn more points for harder difficulties."
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
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            {tagline}
          </div>
        </div>
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <IconArrowRight size={14} />
        </span>
      </div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
      <div className="mt-auto flex items-center justify-between pt-1">
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
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          <IconGame size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold leading-snug">{title}</h2>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Coming soon
          </div>
        </div>
      </div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {description}
      </p>
    </div>
  );
}
