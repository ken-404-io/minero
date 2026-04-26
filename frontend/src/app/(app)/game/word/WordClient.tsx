"use client";

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { IconArrowLeft, IconCoin, IconError, IconSparkles } from "@/components/icons";
import {
  Puzzle,
  canFormWord,
  gridBounds,
  gridCells,
  isBonusWord,
  isPuzzleWord,
  puzzleForLevel,
  utcDayIndex,
} from "./words";
import {
  emitBalanceChange,
  finishGameSession,
  startGameSession,
} from "@/lib/game-session";

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
// v2: starting puzzle no longer rotates by day — old persisted "found"
// words could pre-finish the new starting puzzle if they happened to
// match its grid words, so we discard pre-v2 progress on first read.
const PROGRESS_KEY = "minero_word_progress_v2";

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


/* ============================================================
   Local glyphs (small SVGs the shared icon set doesn't ship)
   ============================================================ */

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
   Flying letter overlay
   ------------------------------------------------------------
   When a puzzle word is found, the parent pushes a Flight per
   letter. Each Flight mounts as a fixed-positioned tile at its
   `from` viewport coords; after `delayMs` it transitions to
   `to`, and after delay+duration the parent's onLanded callback
   fires so the flight can be removed and the corresponding grid
   cell can reveal.
   ============================================================ */

function FlyingLetter({
  flight,
  onLanded,
}: {
  flight: Flight;
  onLanded: (id: string) => void;
}) {
  // Initial position is the "from" point; after the per-letter delay we
  // setState to the "to" point so the CSS transition runs to the target.
  const [pos, setPos] = useState<{ x: number; y: number }>({
    x: flight.fromX,
    y: flight.fromY,
  });

  useEffect(() => {
    const startId = window.setTimeout(() => {
      setPos({ x: flight.toX, y: flight.toY });
    }, flight.delayMs);
    const endId = window.setTimeout(() => {
      onLanded(flight.id);
    }, flight.delayMs + FLY_DURATION_MS);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(endId);
    };
  }, [flight, onLanded]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        transition: `left ${FLY_DURATION_MS}ms cubic-bezier(0.34, 1.32, 0.64, 1), top ${FLY_DURATION_MS}ms cubic-bezier(0.34, 1.32, 0.64, 1)`,
        width: 38,
        height: 38,
        borderRadius: 8,
        background: TILE_FILLED_BG,
        border: `1px solid ${TILE_FILLED_BORDER}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30), 0 4px 14px rgba(0,0,0,0.30)",
        color: TILE_TEXT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: 19,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {flight.ch.toUpperCase()}
    </div>
  );
}

/* ============================================================
   Crossword grid
   ------------------------------------------------------------
   Renders a sparse rows×cols grid. Cells without a letter are
   transparent placeholders; cells with a letter render an empty
   white tile until the word is in `revealedSet`, after which
   the tile flips to a violet gradient with the letter on top.
   `tileRefs` is populated as cells mount so the parent can look
   up viewport positions for fly-letter targets in step 3.
   ============================================================ */

function Crossword({
  puzzle,
  revealedSet,
  tileRefs,
  phase,
}: {
  puzzle: Puzzle;
  revealedSet: Set<string>;
  tileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  phase: Phase;
}) {
  const { rows, cols } = useMemo(() => gridBounds(puzzle), [puzzle]);
  const cells = useMemo(() => gridCells(puzzle), [puzzle]);

  const revealedByIdx = useMemo(
    () => puzzle.words.map((w) => revealedSet.has(w.word)),
    [puzzle.words, revealedSet],
  );

  // Measure the parent surface and size each tile so the whole grid fits.
  // We bound by both width and height: tilePx = floor(min((w - pad)/cols,
  // (h - pad)/rows) - gap). The fallback before the observer fires picks
  // a sensible mid-range value so the first paint isn't comically huge.
  // The floor (14) is deliberately small — better to render readable-but-
  // tight tiles than to overflow the available space and force a scroll.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [tilePx, setTilePx] = useState<number>(36);
  const gapPx = 5;
  useEffect(() => {
    const el = wrapperRef.current?.parentElement; // the surface <section>
    if (!el) return;
    const recompute = () => {
      const r = el.getBoundingClientRect();
      const padX = 8;
      const padY = 8;
      const usableW = Math.max(0, r.width - padX);
      const usableH = Math.max(0, r.height - padY);
      const byW = (usableW - gapPx * (cols - 1)) / Math.max(1, cols);
      const byH = (usableH - gapPx * (rows - 1)) / Math.max(1, rows);
      const px = Math.floor(Math.max(14, Math.min(48, byW, byH)));
      setTilePx(px);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener("orientationchange", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", recompute);
    };
  }, [rows, cols]);

  return (
    <div
      ref={wrapperRef}
      role="grid"
      aria-label="Crossword grid"
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${rows}, ${tilePx}px)`,
        gridTemplateColumns: `repeat(${cols}, ${tilePx}px)`,
        gap: gapPx,
      }}
    >
      {Array.from({ length: rows * cols }).map((_, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        const cell = cells.get(`${r},${c}`);
        if (!cell) {
          return <span key={k} aria-hidden style={{ width: tilePx, height: tilePx }} />;
        }
        const revealed = cell.wordIdx.some((i) => revealedByIdx[i]);
        const cellKey = `${r},${c}`;
        return (
          <CrossTile
            key={k}
            cellKey={cellKey}
            tileRefs={tileRefs}
            letter={cell.letter}
            revealed={revealed}
            size={tilePx}
            phase={phase}
            cellOrder={k}
          />
        );
      })}
    </div>
  );
}

function CrossTile({
  cellKey,
  tileRefs,
  letter,
  revealed,
  size,
  phase,
  cellOrder,
}: {
  cellKey: string;
  tileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  letter: string;
  revealed: boolean;
  size: number;
  phase: Phase;
  cellOrder: number;
}) {
  // Drive per-cell stagger off grid order. `both` keeps the start/end
  // state held so a tile is invisible before its turn (entering) or stays
  // fallen after its turn (exiting). When phase flips back to "playing",
  // the animation property clears and the tile snaps to its idle look.
  const animation =
    phase === "exiting"
      ? `wordTileFallOut ${EXIT_DURATION_MS}ms cubic-bezier(0.55, 0.06, 0.68, 0.19) ${cellOrder * EXIT_PER_CELL_MS}ms both`
      : phase === "entering"
        ? `wordTileFallIn ${ENTER_DURATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${cellOrder * ENTER_PER_CELL_MS}ms both`
        : undefined;

  return (
    <div
      ref={(el) => {
        if (el) tileRefs.current.set(cellKey, el);
        else tileRefs.current.delete(cellKey);
      }}
      role="gridcell"
      data-cell={cellKey}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: revealed ? TILE_FILLED_BG : TILE_EMPTY_BG,
        border: `1px solid ${revealed ? TILE_FILLED_BORDER : TILE_EMPTY_BORDER}`,
        boxShadow: revealed
          ? "inset 0 1px 0 rgba(255,255,255,0.30), 0 1px 2px rgba(0,0,0,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 1px rgba(0,0,0,0.06)",
        color: revealed ? TILE_TEXT : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.5,
        textTransform: "uppercase",
        lineHeight: 1,
        letterSpacing: "0.02em",
        transition: "background 220ms ease, color 220ms ease, border-color 220ms ease",
        animation,
      }}
    >
      {revealed ? letter.toUpperCase() : ""}
    </div>
  );
}

/* ============================================================
   Letter wheel
   ------------------------------------------------------------
   Pointer-driven swipe selector. Letters are arranged on a
   circle; the user presses, drags through neighbours, and
   releases to submit. Backtracking over the previous letter
   undoes the last hop. SVG hit-testing means the same code
   handles touch, mouse, and pen.
   ============================================================ */

const HIT_RADIUS = WHEEL_LETTER_R + 6;

function LetterWheel({
  letters,
  selection,
  onSelectionChange,
  onSubmit,
  svgRef,
  shuffleNonce,
}: {
  letters: string[];
  selection: number[];
  onSelectionChange: (next: number[]) => void;
  onSubmit: () => void;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  /** Bumped on every shuffle. We key the SVG by it so the spin keyframes
   *  re-fire on each click without us having to remove/re-add a class. */
  shuffleNonce: number;
}) {
  const draggingRef = useRef(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const positions = useMemo(
    () => letters.map((_, i) => wheelLetterPos(i, letters.length)),
    [letters],
  );

  const toViewBox = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * WHEEL_VIEWBOX,
        y: ((clientY - rect.top) / rect.height) * WHEEL_VIEWBOX,
      };
    },
    [svgRef],
  );

  const hitLetter = useCallback(
    (vx: number, vy: number): number => {
      let best = -1;
      let bestDist = HIT_RADIUS;
      for (let i = 0; i < positions.length; i++) {
        const d = Math.hypot(positions[i].x - vx, positions[i].y - vy);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    [positions],
  );

  const updateSelection = useCallback(
    (idx: number) => {
      if (idx < 0) return;
      // Drag-back-over-previous = undo last hop (Wordscapes behaviour).
      if (selection.length >= 2 && selection[selection.length - 2] === idx) {
        onSelectionChange(selection.slice(0, -1));
        return;
      }
      if (selection.includes(idx)) return;
      onSelectionChange([...selection, idx]);
    },
    [onSelectionChange, selection],
  );

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const v = toViewBox(e.clientX, e.clientY);
    if (!v) return;
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setPointer(v);
    const idx = hitLetter(v.x, v.y);
    onSelectionChange(idx >= 0 ? [idx] : []);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const v = toViewBox(e.clientX, e.clientY);
    if (!v) return;
    setPointer(v);
    const idx = hitLetter(v.x, v.y);
    if (idx >= 0) updateSelection(idx);
  };

  const finish = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setPointer(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onSubmit();
  };

  // Selection trail polyline points: each selected letter center plus the
  // current pointer (only non-null mid-drag, so its presence drives the
  // trailing segment without reading the dragging ref during render).
  const linePoints = useMemo(() => {
    const pts = selection.map((i) => `${positions[i].x},${positions[i].y}`);
    if (pointer) pts.push(`${pointer.x},${pointer.y}`);
    return pts.join(" ");
  }, [positions, selection, pointer]);

  return (
    <svg
      key={shuffleNonce}
      ref={svgRef}
      viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}
      width={WHEEL_VIEWBOX}
      height={WHEEL_VIEWBOX}
      role="application"
      aria-label="Letter wheel"
      style={{
        // Bound by both width AND height so very short or narrow viewports
        // still show the whole wheel without clipping. The 30svh + 240px
        // ceiling keeps the wheel from monopolising the screen on tablets,
        // and the 140px floor keeps the letter circles tappable on tiny
        // phones.
        width: "min(72vw, max(140px, min(30svh, 240px)))",
        height: "auto",
        touchAction: "none",
        userSelect: "none",
        // Re-fires on each remount via the `key` prop above. The first
        // render (nonce 0) has no animation so the wheel doesn't spin
        // on initial mount.
        animation:
          shuffleNonce > 0
            ? "wordWheelSpin 480ms cubic-bezier(0.34, 1.56, 0.64, 1)"
            : undefined,
        transformOrigin: "center",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {/* Hub */}
      <circle
        cx={WHEEL_CENTER}
        cy={WHEEL_CENTER}
        r={WHEEL_RING_R + WHEEL_LETTER_R + 8}
        fill={WHEEL_HUB_BG}
        stroke={WHEEL_HUB_STROKE}
        strokeWidth={1}
      />
      {/* Selection trail (under the letter circles) */}
      {selection.length > 0 && (
        <polyline
          points={linePoints}
          fill="none"
          stroke={WHEEL_LINE}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      )}
      {/* Letter circles */}
      {positions.map((p, i) => {
        const selected = selection.includes(i);
        return (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={WHEEL_LETTER_R}
              fill={selected ? WHEEL_LETTER_SELECTED_BG : WHEEL_LETTER_BG}
              stroke={selected ? WHEEL_LETTER_SELECTED_BG : WHEEL_LETTER_STROKE}
              strokeWidth={2}
            />
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={WHEEL_LETTER_R}
              fontWeight={800}
              fill={selected ? WHEEL_LETTER_SELECTED_TEXT : WHEEL_LETTER_TEXT}
              style={{ textTransform: "uppercase", pointerEvents: "none" }}
            >
              {letters[i].toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   Selection preview + bonus dots
   ============================================================ */

function FlashPill({ flash }: { flash: Flash }) {
  // Visual treatment per kind. Found/bonus get a positive look; duplicates,
  // tooshort, and invalid words get a quieter "no" treatment.
  let bg = "rgba(255,255,255,0.18)";
  const fg = "#ffffff";
  let prefix: React.ReactNode = null;
  let suffix: React.ReactNode = null;
  let label: string = flash.word.toUpperCase();

  if (flash.kind === "found") {
    bg = "linear-gradient(180deg, #34c759 0%, #1f9e44 100%)";
    prefix = <IconSparkles size={14} />;
    if (flash.coins) {
      suffix = (
        <>
          {" "}+ <IconCoin size={12} /> {flash.coins}
        </>
      );
    }
  } else if (flash.kind === "bonus") {
    bg = "linear-gradient(180deg, #f5a623 0%, #c87b08 100%)";
    prefix = <IconSparkles size={14} />;
    suffix = flash.coins ? (
      <>
        {" "}+ <IconCoin size={12} /> {flash.coins} (bonus)
      </>
    ) : (
      " (bonus)"
    );
  } else if (flash.kind === "duplicate") {
    bg = "rgba(255,255,255,0.22)";
    label = `Already found: ${flash.word.toUpperCase()}`;
  } else if (flash.kind === "invalid") {
    bg = "rgba(220, 60, 60, 0.85)";
    prefix = <IconError size={14} />;
    label = `Not a word`;
  } else if (flash.kind === "tooshort") {
    bg = "rgba(255,255,255,0.22)";
    label = "Too short";
  }

  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        background: bg,
        color: fg,
        padding: "6px 14px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: "0.05em",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        animation: "wordFloatPill 1.2s ease both",
      }}
    >
      {prefix}
      <span>{label}</span>
      {suffix}
    </span>
  );
}

function SelectionPreview({ word }: { word: string }) {
  if (!word) {
    return (
      <span style={{ opacity: 0.6, fontSize: 13 }}>
        Drag across the wheel to spell a word
      </span>
    );
  }
  return (
    <span
      style={{
        background: WHEEL_LETTER_SELECTED_BG,
        color: WHEEL_LETTER_SELECTED_TEXT,
        padding: "6px 16px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 22,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      }}
    >
      {word}
    </span>
  );
}

function BonusDots({ found, total }: { found: number; total: number }) {
  // Cap the visible row so very long bonus lists don't blow out the layout.
  const slots = Math.min(8, Math.max(4, total));
  const filled =
    total === 0 ? 0 : Math.min(slots, Math.round((found / total) * slots));
  return (
    <>
      {Array.from({ length: slots }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: i < filled ? BONUS_DOT_FILLED : BONUS_DOT_EMPTY,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
          }}
        />
      ))}
    </>
  );
}

/* ============================================================
   Main component
   ------------------------------------------------------------
   Step 2: wires the real grid + wheel into the layout. No
   word validation or scoring yet — pointer-up just clears the
   chain so the user can practice tracing letters and watch the
   selection preview update.
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
  const puzzle = useMemo(() => puzzleForLevel(level), [level]);

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

  /** Word currently traced on the wheel (derived from selection indices). */
  const currentWord = useMemo(
    () => selection.map((i) => wheelLetters[i]).join(""),
    [selection, wheelLetters],
  );

  // Bumped on every shuffle so LetterWheel can re-key its SVG and re-fire
  // the spin keyframes without us touching DOM classes manually.
  const [shuffleNonce, setShuffleNonce] = useState(0);

  /** Reshuffle the wheel letters; avoids returning the same order back. */
  const reshuffle = useCallback(() => {
    setWheelLetters((prev) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const next = shuffle(prev);
        if (next.join("") !== prev.join("")) return next;
      }
      return shuffle(prev);
    });
    setShuffleNonce((n) => n + 1);
  }, []);

  /* ----- flash messages ----- */
  // Monotonic id keeps two consecutive identical flashes (e.g. two
  // duplicates of the same word) from being elided as the same React node.
  const flashCounterRef = useRef(0);
  const flashMsg = useCallback(
    (kind: FlashKind, word: string, coins?: number) => {
      flashCounterRef.current += 1;
      setFlash({ id: flashCounterRef.current, kind, word, coins });
    },
    [],
  );

  /* ----- letter fly-in to the grid ----- */

  const triggerFlight = useCallback(
    (wordIdx: number, sourceIndices: number[]) => {
      const placement = puzzle.words[wordIdx];
      if (!placement) return;
      const svg = wheelSvgRef.current;
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();
      const scale = svgRect.width / WHEEL_VIEWBOX;

      const newFlights: Flight[] = [];
      for (let i = 0; i < placement.word.length; i++) {
        const r = placement.dir === "h" ? placement.row : placement.row + i;
        const c = placement.dir === "h" ? placement.col + i : placement.col;
        const tile = tileRefs.current.get(`${r},${c}`);
        if (!tile) continue;
        const tr = tile.getBoundingClientRect();
        const wp = wheelLetterPos(sourceIndices[i], wheelLetters.length);
        newFlights.push({
          id: `f-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          ch: placement.word[i],
          fromX: svgRect.left + wp.x * scale,
          fromY: svgRect.top + wp.y * scale,
          toX: tr.left + tr.width / 2,
          toY: tr.top + tr.height / 2,
          delayMs: i * FLY_PER_LETTER_MS,
          word: placement.word,
        });
      }

      setFlights((prev) => [...prev, ...newFlights]);

      // Reveal the word in the grid once the last letter has landed.
      const totalMs = (placement.word.length - 1) * FLY_PER_LETTER_MS + FLY_DURATION_MS;
      window.setTimeout(() => {
        setRevealedWords((prev) => {
          const next = new Set(prev);
          next.add(placement.word);
          return next;
        });
      }, totalMs);
    },
    [puzzle, wheelLetters.length],
  );

  const onFlightLanded = useCallback((id: string) => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /* ----- pointer-up validation ----- */

  const onWheelSubmit = useCallback(() => {
    const sel = selection;
    setSelection([]);
    if (sel.length === 0) return;
    const word = sel.map((i) => wheelLetters[i]).join("");

    if (word.length < 3) {
      if (word.length > 0) flashMsg("tooshort", word);
      return;
    }
    if (!canFormWord(puzzle, word)) {
      flashMsg("invalid", word);
      return;
    }

    // Lazy-start the server session on the first valid attempt today.
    if (!sessionStartedRef.current && !finalizedRef.current) {
      sessionStartedRef.current = true;
      startGameSession("word").then((r) => {
        if (r.ok) sessionIdRef.current = r.sessionId;
      });
    }

    const wordIdx = isPuzzleWord(puzzle, word);
    if (wordIdx >= 0) {
      if (foundWords.has(word)) {
        flashMsg("duplicate", word);
        return;
      }
      setFoundWords((prev) => {
        const next = new Set(prev);
        next.add(word);
        return next;
      });
      triggerFlight(wordIdx, sel);
      flashMsg("found", word, COINS_PER_PUZZLE_WORD);
      return;
    }

    if (isBonusWord(puzzle, word)) {
      if (foundBonus.has(word)) {
        flashMsg("duplicate", word);
        return;
      }
      setFoundBonus((prev) => {
        const next = new Set(prev);
        next.add(word);
        return next;
      });
      flashMsg("bonus", word, COINS_PER_BONUS_WORD);
      return;
    }

    flashMsg("invalid", word);
  }, [
    selection,
    wheelLetters,
    puzzle,
    foundWords,
    foundBonus,
    flashMsg,
    triggerFlight,
  ]);

  /* ----- persistence + flash auto-clear + level finalize ----- */

  // Save in-progress state on every change so a refresh keeps found words.
  useEffect(() => {
    writeProgress({
      dayIndex: today.dayIndex,
      level,
      found: Array.from(foundWords),
      bonus: Array.from(foundBonus),
      finalized: finalizedRef.current,
    });
  }, [today.dayIndex, level, foundWords, foundBonus]);

  // Flash messages clear themselves so repeated guesses keep updating it.
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 1200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const allFound = foundWords.size === puzzle.words.length;
  const totalScoreToday =
    foundWords.size * COINS_PER_PUZZLE_WORD +
    foundBonus.size * COINS_PER_BONUS_WORD +
    (allFound ? COINS_FULL_CLEAR_BONUS : 0);

  // Server finalize fires once the player clears every grid word for the day.
  // Subsequent levels (steps 4–5) advance locally; the server enforces the
  // 24h cooldown so only the first clear pays out.
  const finalize = useCallback(
    (solved: boolean) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const score = totalScoreToday;
      const prev = getStatsSnapshot();
      const nextStreak = solved ? prev.currentStreak + 1 : 0;
      writeStats({
        totalCoins: prev.totalCoins + score,
        gamesPlayed: prev.gamesPlayed + 1,
        puzzlesSolved: prev.puzzlesSolved + (solved ? 1 : 0),
        currentStreak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
        lastPlayedDay: today.dayIndex,
        lastResult: solved ? "solved" : "partial",
      });
      if (sessionIdRef.current) {
        const sid = sessionIdRef.current;
        sessionIdRef.current = null;
        finishGameSession(sid, score).then((r) => {
          if (r.ok) emitBalanceChange();
        });
      }
    },
    [totalScoreToday, today.dayIndex],
  );

  useEffect(() => {
    if (allFound && !finalizedRef.current) {
      finalize(true);
    }
  }, [allFound, finalize]);

  /* ----- level transitions: exit → swap puzzle → enter → play ----- */

  // Total cells in the current grid drives the longest stagger so we know
  // when each phase's animation has fully finished.
  const cellCount = useMemo(() => {
    const { rows, cols } = gridBounds(puzzle);
    return rows * cols;
  }, [puzzle]);

  // Once every grid word is found AND every fly-in has landed, hold for a
  // beat so the player can read the last reveal, then flip to "exiting"
  // which drives the per-cell fall-down animation in CrossTile.
  useEffect(() => {
    if (phase !== "playing") return;
    if (!allFound) return;
    if (flights.length > 0) return;
    const t = window.setTimeout(() => setPhase("exiting"), LEVEL_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, allFound, flights.length]);

  // Phase "exiting" — once the last cell has finished falling out, advance
  // the level, reset per-puzzle state, reshuffle the wheel for the new
  // letter set, and flip to "entering" so the new tiles fall in from above.
  useEffect(() => {
    if (phase !== "exiting") return;
    const totalMs =
      Math.max(0, cellCount - 1) * EXIT_PER_CELL_MS +
      EXIT_DURATION_MS +
      LEVEL_INTERLUDE_MS;
    const t = window.setTimeout(() => {
      const nextLevel = level + 1;
      const nextPuzzle = puzzleForLevel(nextLevel);
      setLevel(nextLevel);
      setWheelLetters(shuffle(nextPuzzle.letters));
      setFoundWords(new Set());
      setFoundBonus(new Set());
      setRevealedWords(new Set());
      setSelection([]);
      setFlash(null);
      setFlights([]);
      // The server session has already been finalized for today on the
      // first all-found; subsequent levels are local-only.
      setPhase("entering");
    }, totalMs);
    return () => window.clearTimeout(t);
  }, [phase, cellCount, level, today.dayIndex]);

  // Phase "entering" — return to playing once every cell has landed.
  useEffect(() => {
    if (phase !== "entering") return;
    const totalMs =
      Math.max(0, cellCount - 1) * ENTER_PER_CELL_MS + ENTER_DURATION_MS + 50;
    const t = window.setTimeout(() => setPhase("playing"), totalMs);
    return () => window.clearTimeout(t);
  }, [phase, cellCount]);

  void stats;
  void playerName;

  return (
    <div
      className="word-game-root"
      style={{
        // 100svh + overflow:hidden is the baseline. On phones the game
        // additionally claims the whole viewport via `position: fixed`
        // (see CSS below) so the mobile topbar, ad banner, and bottom
        // nav don't push the wheel off-screen. On desktop we keep
        // normal flow so the side nav stays visible.
        height: "100svh",
        maxHeight: "100svh",
        background:
          "linear-gradient(180deg, var(--bg) 0%, color-mix(in oklab, var(--brand) 8%, var(--bg)) 100%)",
        display: "flex",
        flexDirection: "column",
        color: "var(--text)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Compact back overlay (replaces the page-level back strip so the
          wheel never pushes off-screen on short viewports). */}
      <Link
        href="/game"
        aria-label="Back to all games"
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 5,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        <IconArrowLeft size={16} />
      </Link>

      {/* Level badge — small, top-right, just so the player can tell where
          they are when the puzzle changes. */}
      <span
        aria-label={`Level ${level + 1}`}
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 5,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Lvl {level + 1}
      </span>

      {/* Crossword surface ------------------------------------- */}
      <section
        className="word-grid-surface"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Top reserves room for the back/level overlays; horizontal/bottom
          // stay tight so the grid claims as much height as possible.
          padding: "36px 8px 4px",
          overflow: "hidden",
        }}
        aria-label="Crossword grid"
      >
        <Crossword
          puzzle={puzzle}
          revealedSet={revealedWords}
          tileRefs={tileRefs}
          phase={phase}
        />
      </section>

      {/* Right stack — bonus dots, selection, wheel. Uses `display:
          contents` in portrait so it's flat in the DOM, and becomes the
          right column when the landscape media query takes over. */}
      <div className="word-right-stack">

      {/* Bonus dot row ----------------------------------------- */}
      <div
        className="word-bonus-row"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 5,
          padding: "1px 16px",
        }}
        aria-hidden
      >
        <BonusDots found={foundBonus.size} total={puzzle.bonus.length} />
      </div>

      {/* Selection preview floats above the wheel ------------- */}
      <div
        className="word-selection-row"
        style={{
          minHeight: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1px 16px",
        }}
      >
        {flash ? (
          <FlashPill key={flash.id} flash={flash} />
        ) : (
          <SelectionPreview word={currentWord} />
        )}
      </div>

      {/* Wheel area -------------------------------------------- */}
      <section
        className="word-wheel-surface"
        style={{
          padding: "2px 16px calc(8px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          // Lock interaction while cells are mid-fall so a stray drag
          // doesn't queue a flight on tiles that aren't really there yet.
          pointerEvents: phase === "playing" ? "auto" : "none",
          opacity: phase === "playing" ? 1 : 0.7,
          transition: "opacity 200ms ease",
        }}
        aria-label="Letter wheel"
      >
        {/* Shuffle control (only side action retained) */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "min(86vw, 360px)",
          }}
        >
          <button
            type="button"
            aria-label="Shuffle letters"
            onClick={reshuffle}
            style={hudButtonStyle}
          >
            <GlyphShuffle size={18} />
          </button>
        </div>

        <LetterWheel
          letters={wheelLetters}
          selection={selection}
          onSelectionChange={setSelection}
          onSubmit={onWheelSubmit}
          svgRef={wheelSvgRef}
          shuffleNonce={shuffleNonce}
        />
      </section>

      </div>{/* /.word-right-stack */}

      {/* Flying letter overlay — fixed-positioned, escapes layout */}
      {flights.map((f) => (
        <FlyingLetter key={f.id} flight={f} onLanded={onFlightLanded} />
      ))}

      <style>{`
        /* On phones, take over the full viewport so the mobile topbar,
           ad banner, and bottom nav don't squeeze the game vertically.
           On desktop (lg+) the side nav stays visible and the game uses
           normal flow inside main. */
        @media (max-width: 1023px) {
          .word-game-root {
            position: fixed !important;
            inset: 0 !important;
            z-index: 40;
            padding-top: env(safe-area-inset-top, 0px);
          }
        }
        /* In portrait the right-stack wrapper is invisible to layout so
           bonus/selection/wheel render exactly as if they were direct
           children of the root flex column. In landscape it activates as
           a real flex column on the right side of the row layout. */
        .word-right-stack {
          display: contents;
        }
        /* Landscape (and any short-viewport tall-aspect device) reflows
           the game into two columns: grid on the left, wheel + chrome on
           the right. Without this, the stacked-column layout has to share
           a tiny vertical budget with the wheel and tiles end up too
           small to read. */
        @media (orientation: landscape) and (max-height: 640px) {
          .word-game-root {
            flex-direction: row !important;
            align-items: stretch;
          }
          .word-grid-surface {
            flex: 1 1 auto;
            padding: 36px 8px 8px !important;
          }
          .word-right-stack {
            display: flex !important;
            flex-direction: column;
            justify-content: center;
            align-items: stretch;
            flex: 0 0 auto;
            width: clamp(220px, 42vw, 300px);
            padding: 36px 0 calc(8px + env(safe-area-inset-bottom, 0px));
          }
          .word-bonus-row,
          .word-selection-row {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .word-wheel-surface {
            padding: 4px 8px 4px !important;
          }
        }
        @keyframes wordFloatPill {
          0%   { opacity: 0; transform: translateY(6px) scale(0.96); }
          15%  { opacity: 1; transform: translateY(0) scale(1.02); }
          25%  { transform: translateY(0) scale(1); }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-3px) scale(1); }
        }
        /* Per-cell drop on level clear. Cells gain a tiny rotation +
           translation that accelerates downward, then fade out. */
        @keyframes wordTileFallOut {
          0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
          20%  { opacity: 1; transform: translateY(-4px) rotate(-2deg); }
          100% { opacity: 0; transform: translateY(220px) rotate(8deg); }
        }
        /* Reverse drop for the next level entering. Cells start above
           and out of view, then fall into place with a tiny overshoot. */
        @keyframes wordTileFallIn {
          0%   { opacity: 0; transform: translateY(-220px) rotate(-8deg); }
          70%  { opacity: 1; transform: translateY(8px) rotate(2deg); }
          100% { opacity: 1; transform: translateY(0) rotate(0deg); }
        }
        /* One-shot rotation on shuffle — the new letter order paints in
           place, then the whole wheel spins once to acknowledge the
           reshuffle. The cubic-bezier overshoots slightly so it lands
           with a small bounce. */
        @keyframes wordWheelSpin {
          0%   { transform: rotate(-30deg) scale(0.94); }
          60%  { transform: rotate(380deg) scale(1.02); }
          100% { transform: rotate(360deg) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Inline style fragments shared by HUD bits
   ============================================================ */

const hudButtonStyle: React.CSSProperties = {
  position: "relative",
  width: 40,
  height: 40,
  borderRadius: 999,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
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
