"use client";

import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  IconArrowLeft,
  IconCoin,
  IconSparkles,
} from "@/components/icons";
import { PUZZLES, Puzzle, utcDayIndex } from "./words";

/* ============================================================
   Config
   ------------------------------------------------------------
   Coin values, storage keys, and animation timings (ms). The
   server clamps coin awards via its per-game cap, so tweaks
   here are display-only above the daily cap.
   ============================================================ */

const COINS_PER_PUZZLE_WORD = 30;
const COINS_PER_BONUS_WORD = 10;
const COINS_FULL_CLEAR_BONUS = 100;

const STATS_KEY = "minero_word_stats_v1";
const PROGRESS_KEY = "minero_word_progress_v1";

// Letter-fly animation: how long each letter takes to fly from the wheel
// to its grid cell, and how long to wait between sequential letters.
export const FLY_PER_LETTER_MS = 90;
export const FLY_DURATION_MS = 420;

// Level-complete fall-out: each cell falls with a stagger so the grid
// "shatters" downward. New-level fall-in mirrors this.
export const EXIT_PER_CELL_MS = 30;
export const EXIT_DURATION_MS = 480;
export const ENTER_PER_CELL_MS = 30;
export const ENTER_DURATION_MS = 480;

// Beats between phases so transitions feel paced rather than instant.
export const LEVEL_HOLD_MS = 360;       // win pause before exit starts
export const LEVEL_INTERLUDE_MS = 220;  // pause between exit ending and enter starting

/* ============================================================
   Wordscapes-style local palette
   ------------------------------------------------------------
   The app's brand token is amber; the reference uses a violet
   tile + white wheel. We keep these inline so they don't fight
   with theme tokens elsewhere.
   ============================================================ */

const TILE_FILLED_BG = "linear-gradient(180deg, #7665e3 0%, #4a3fb0 100%)";
const TILE_FILLED_BORDER = "#3c318f";
const TILE_EMPTY_BG = "rgba(255,255,255,0.94)";
const TILE_EMPTY_BORDER = "rgba(0,0,0,0.10)";
const TILE_TEXT = "#ffffff";
const WHEEL_HUB_BG = "rgba(255,255,255,0.96)";
const WHEEL_HUB_STROKE = "rgba(0,0,0,0.08)";
const WHEEL_LETTER_BG = "#ffffff";
const WHEEL_LETTER_STROKE = "rgba(0,0,0,0.10)";
const WHEEL_LETTER_TEXT = "#1c1340";
const WHEEL_LETTER_SELECTED_BG = "#5a4ed4";
const WHEEL_LETTER_SELECTED_TEXT = "#ffffff";
const WHEEL_LINE = "#5a4ed4";
const BONUS_DOT_FILLED = "#f5a623";
const BONUS_DOT_EMPTY = "rgba(255,255,255,0.55)";

/* ============================================================
   Types
   ============================================================ */

type Phase = "playing" | "exiting" | "entering";

type FlashKind = "found" | "bonus" | "duplicate" | "invalid" | "tooshort";
type Flash = { id: number; kind: FlashKind; word: string; coins?: number };

/** A single letter mid-flight from the wheel into its grid cell. */
type Flight = {
  id: string;
  ch: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delayMs: number;
  /** Word the flight belongs to, so we can reveal that grid word once
   *  every letter in the flight batch has landed. */
  word: string;
};

type Stats = {
  totalCoins: number;
  gamesPlayed: number;
  puzzlesSolved: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedDay: number;
  lastResult: "solved" | "partial" | null;
};

const EMPTY_STATS: Stats = {
  totalCoins: 0,
  gamesPlayed: 0,
  puzzlesSolved: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDay: -1,
  lastResult: null,
};

type Progress = {
  dayIndex: number;
  level: number;            // levels completed beyond the daily seed
  found: string[];          // puzzle words found in current level
  bonus: string[];          // bonus words found in current level
  finalized: boolean;       // server session has been finalized today
};

/* ============================================================
   Lifetime stats (localStorage, useSyncExternalStore-shaped)
   ============================================================ */

function parseStats(raw: string | null): Stats {
  if (!raw) return EMPTY_STATS;
  try {
    const p = JSON.parse(raw) as Partial<Stats> & { totalPoints?: number };
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      puzzlesSolved: Number(p.puzzlesSolved) || 0,
      currentStreak: Number(p.currentStreak) || 0,
      bestStreak: Number(p.bestStreak) || 0,
      lastPlayedDay:
        typeof p.lastPlayedDay === "number" && Number.isFinite(p.lastPlayedDay)
          ? p.lastPlayedDay
          : -1,
      lastResult:
        p.lastResult === "solved" || p.lastResult === "partial"
          ? p.lastResult
          : null,
    };
  } catch {
    return EMPTY_STATS;
  }
}

let statsRaw: string | null = null;
let statsCache: Stats = EMPTY_STATS;

function getStatsSnapshot(): Stats {
  if (typeof window === "undefined") return EMPTY_STATS;
  const raw = window.localStorage.getItem(STATS_KEY);
  if (raw !== statsRaw) {
    statsRaw = raw;
    statsCache = parseStats(raw);
  }
  return statsCache;
}

function getStatsServer(): Stats {
  return EMPTY_STATS;
}

const statsListeners = new Set<() => void>();

function subscribeStats(cb: () => void) {
  statsListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STATS_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    statsListeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStats(next: Stats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
    statsRaw = window.localStorage.getItem(STATS_KEY);
    statsCache = parseStats(statsRaw);
    statsListeners.forEach((cb) => cb());
    window.dispatchEvent(new StorageEvent("storage", { key: STATS_KEY }));
  } catch {
    /* quota / private mode */
  }
}

/* ============================================================
   Per-day progress (localStorage)
   ============================================================ */

function readProgress(dayIndex: number): Progress {
  if (typeof window === "undefined") {
    return { dayIndex, level: 0, found: [], bonus: [], finalized: false };
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { dayIndex, level: 0, found: [], bonus: [], finalized: false };
    const p = JSON.parse(raw) as Partial<Progress>;
    if (p.dayIndex !== dayIndex) {
      return { dayIndex, level: 0, found: [], bonus: [], finalized: false };
    }
    return {
      dayIndex,
      level: typeof p.level === "number" && p.level >= 0 ? p.level : 0,
      found: Array.isArray(p.found) ? p.found.filter((s) => typeof s === "string") : [],
      bonus: Array.isArray(p.bonus) ? p.bonus.filter((s) => typeof s === "string") : [],
      finalized: Boolean(p.finalized),
    };
  } catch {
    return { dayIndex, level: 0, found: [], bonus: [], finalized: false };
  }
}

function writeProgress(p: Progress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/* ============================================================
   Helpers
   ============================================================ */

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministic puzzle for a (day, level) pair. The day seeds the start so
 *  every player sees the same opening puzzle on the same calendar day; level
 *  walks forward through the curated pool from there. */
export function puzzleFor(dayIndex: number, level: number): Puzzle {
  const OFFSET = 7;
  const idx = (((dayIndex + OFFSET + level) % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
  return PUZZLES[idx];
}

/* ============================================================
   Local glyphs (HUD bits the shared icon set doesn't ship yet)
   ============================================================ */

function GlyphStar({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2.6l2.95 5.97 6.59.96-4.77 4.65 1.13 6.56L12 17.77l-5.9 3.10 1.13-6.56-4.77-4.65 6.59-.96L12 2.6z"
      />
    </svg>
  );
}

function GlyphShop({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M3 6h18l-2 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L3 6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M8 6V4a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphShuffle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M16 4h4v4M4 20l16-16M20 16v4h-4M4 4l6 6m4 4l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlyphBulb({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.7.6 1 1.4 1 2.3v1h6v-1c0-.9.3-1.7 1-2.3A7 7 0 0 0 12 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================================================
   Wheel layout constants (used by both the wheel SVG and the
   parent component when it computes fly-source positions)
   ============================================================ */

export const WHEEL_VIEWBOX = 280;
export const WHEEL_CENTER = WHEEL_VIEWBOX / 2;
export const WHEEL_RING_R = 100;
export const WHEEL_LETTER_R = 28;

/** Centre of the i-th letter on a wheel with `n` letters, in viewBox coords.
 *  Top-of-wheel goes first, then clockwise. */
export function wheelLetterPos(i: number, n: number): { x: number; y: number } {
  const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return {
    x: WHEEL_CENTER + WHEEL_RING_R * Math.cos(theta),
    y: WHEEL_CENTER + WHEEL_RING_R * Math.sin(theta),
  };
}

/* ============================================================
   Main component
   ------------------------------------------------------------
   Step 1 of the rewrite: layout shell only. Renders the four
   regions (top bar, crossword surface, bonus dots, wheel) with
   placeholders. No game logic, no animations — those land in
   subsequent steps.
   ============================================================ */

export default function WordClient({ playerName }: { playerName: string }) {
  // Hooks are wired up but most aren't read yet — they're here so the
  // surrounding state structure is in place for steps 2–5.
  const stats = useSyncExternalStore(subscribeStats, getStatsSnapshot, getStatsServer);

  const [today] = useState(() => ({ dayIndex: utcDayIndex(Date.now()) }));
  const initialProgress = useMemo(
    () => readProgress(today.dayIndex),
    [today.dayIndex],
  );

  const [level, setLevel] = useState<number>(initialProgress.level);
  const puzzle = useMemo(
    () => puzzleFor(today.dayIndex, level),
    [today.dayIndex, level],
  );

  const [phase, setPhase] = useState<Phase>("playing");
  const [wheelLetters, setWheelLetters] = useState<string[]>(() =>
    shuffle(puzzle.letters),
  );
  const [foundWords, setFoundWords] = useState<Set<string>>(
    () => new Set(initialProgress.found),
  );
  const [foundBonus, setFoundBonus] = useState<Set<string>>(
    () => new Set(initialProgress.bonus),
  );
  // Cells reveal off `revealedWords` (populated when the fly animation
  // lands), not `foundWords`, so the grid stays empty until letters arrive.
  const [revealedWords, setRevealedWords] = useState<Set<string>>(
    () => new Set(initialProgress.found),
  );
  const [selection, setSelection] = useState<number[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);

  // Refs the next steps will need — declared now so the structure is set.
  const wheelSvgRef = useRef<SVGSVGElement | null>(null);
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedRef = useRef(false);
  const finalizedRef = useRef<boolean>(initialProgress.finalized);

  // Silence unused-binding lints until later steps wire these in.
  void stats;
  void puzzle;
  void phase;
  void setPhase;
  void setLevel;
  void wheelLetters;
  void setWheelLetters;
  void foundWords;
  void setFoundWords;
  void foundBonus;
  void setFoundBonus;
  void revealedWords;
  void setRevealedWords;
  void selection;
  void setSelection;
  void flash;
  void setFlash;
  void flights;
  void setFlights;
  void wheelSvgRef;
  void tileRefs;
  void sessionIdRef;
  void sessionStartedRef;
  void finalizedRef;
  void playerName;

  return (
    <div
      className="word-game-root"
      style={{
        minHeight: "calc(100vh - 56px)",
        background: "linear-gradient(180deg, #2a2456 0%, #4a3fb0 60%, #6b5fd6 100%)",
        display: "flex",
        flexDirection: "column",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top HUD ------------------------------------------------ */}
      <header
        className="word-hud"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
        }}
      >
        <button
          type="button"
          aria-label="Back"
          className="word-hud-btn"
          style={hudButtonStyle}
        >
          <IconArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }} />
        <span style={hudPillStyle}>
          <span style={{ color: "#f5c542", display: "inline-flex" }}>
            <GlyphStar size={14} />
          </span>
          <span style={{ marginLeft: 6, fontWeight: 700 }}>0</span>
        </span>
        <span style={hudPillStyle}>
          <span style={{ color: "#f5c542", display: "inline-flex" }}>
            <IconCoin size={14} />
          </span>
          <span style={{ marginLeft: 6, fontWeight: 700 }}>450</span>
          <button
            type="button"
            aria-label="Shop"
            style={{
              ...hudPillButtonStyle,
              marginLeft: 6,
            }}
          >
            <GlyphShop size={14} />
          </button>
        </span>
      </header>

      {/* Crossword surface ------------------------------------- */}
      <section
        className="word-grid-surface"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
        aria-label="Crossword grid"
      >
        <div
          style={{
            opacity: 0.55,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {/* Step 2 will replace this placeholder with the real grid. */}
          Crossword grid placeholder
        </div>
      </section>

      {/* Bonus dot row ----------------------------------------- */}
      <div
        className="word-bonus-row"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          padding: "4px 16px 12px",
        }}
        aria-hidden
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: BONUS_DOT_EMPTY,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
            }}
          />
        ))}
      </div>

      {/* Wheel area -------------------------------------------- */}
      <section
        className="word-wheel-surface"
        style={{
          padding: "8px 16px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
        aria-label="Letter wheel"
      >
        {/* Side controls (left) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "min(86vw, 360px)",
          }}
        >
          <button type="button" aria-label="Shuffle letters" style={hudButtonStyle}>
            <GlyphShuffle size={18} />
          </button>
          <button type="button" aria-label="Hint" style={hudButtonStyle}>
            <GlyphBulb size={18} />
            <span
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                background: "#f5c542",
                color: "#1c1340",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: 999,
              }}
            >
              100
            </span>
          </button>
        </div>

        {/* Wheel placeholder — step 2 replaces this with the SVG wheel. */}
        <div
          style={{
            width: "min(86vw, 320px)",
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background: WHEEL_HUB_BG,
            border: `1px solid ${WHEEL_HUB_STROKE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: WHEEL_LETTER_TEXT,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Wheel placeholder
        </div>
      </section>

      {/* Selection / flash readout — populated in step 3 ------ */}
      <div style={{ position: "absolute", top: 64, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ opacity: 0.6, fontSize: 12 }}>
          <IconSparkles size={12} /> Step 1 — layout shell only
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Inline style fragments shared by HUD bits
   ============================================================ */

const hudButtonStyle: React.CSSProperties = {
  position: "relative",
  width: 38,
  height: 38,
  borderRadius: 999,
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const hudPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "rgba(0,0,0,0.30)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 13,
  color: "#ffffff",
};

const hudPillButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 999,
  background: "#34c759",
  color: "#ffffff",
  border: "none",
  cursor: "pointer",
};

/* ============================================================
   Re-exports kept so step 2+ can import without touching this
   file's import block.
   ============================================================ */

export type { Phase, Flash, Flight, Progress };
export {
  COINS_FULL_CLEAR_BONUS,
  COINS_PER_BONUS_WORD,
  COINS_PER_PUZZLE_WORD,
  EMPTY_STATS,
  PROGRESS_KEY,
  STATS_KEY,
  TILE_EMPTY_BG,
  TILE_EMPTY_BORDER,
  TILE_FILLED_BG,
  TILE_FILLED_BORDER,
  TILE_TEXT,
  WHEEL_HUB_BG,
  WHEEL_HUB_STROKE,
  WHEEL_LETTER_BG,
  WHEEL_LETTER_SELECTED_BG,
  WHEEL_LETTER_SELECTED_TEXT,
  WHEEL_LETTER_STROKE,
  WHEEL_LETTER_TEXT,
  WHEEL_LINE,
  BONUS_DOT_EMPTY,
  BONUS_DOT_FILLED,
  shuffle,
  readProgress,
  writeProgress,
  writeStats,
  getStatsSnapshot,
  subscribeStats,
};
