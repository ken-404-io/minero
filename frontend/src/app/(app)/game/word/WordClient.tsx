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
import {
  IconClock,
  IconCoin,
  IconError,
  IconSparkles,
  IconTrophy,
} from "@/components/icons";
import {
  Puzzle,
  canFormWord,
  gridBounds,
  gridCells,
  isBonusWord,
  isPuzzleWord,
  puzzleForDay,
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
   Score per word, plus a finishing bonus when every grid word
   is found. Server clamps to the per-session and per-day caps
   defined in backend/src/lib/games.ts so tweaks here can't
   blow past the daily cap.
   ============================================================ */

const COINS_PER_PUZZLE_WORD = 30;
const COINS_PER_BONUS_WORD = 10;
const COINS_FULL_CLEAR_BONUS = 100;

const STATS_KEY = "minero_word_stats_v1";
const PROGRESS_KEY = "minero_word_progress_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

/* ============================================================
   Lifetime stats (localStorage)
   ============================================================ */

type Stats = {
  totalCoins: number;
  gamesPlayed: number;
  puzzlesSolved: number;     // puzzles where every grid word was found
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
   Per-day puzzle progress (localStorage)
   ------------------------------------------------------------
   Holds the words found so far for today's puzzle so a refresh
   doesn't reset progress mid-session. Cleared automatically
   when the day rolls over.
   ============================================================ */

type Progress = {
  dayIndex: number;
  found: string[];   // puzzle words found
  bonus: string[];   // bonus words found
  finalized: boolean; // server session has been finalized for today
};

function readProgress(dayIndex: number): Progress {
  if (typeof window === "undefined") {
    return { dayIndex, found: [], bonus: [], finalized: false };
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { dayIndex, found: [], bonus: [], finalized: false };
    const p = JSON.parse(raw) as Partial<Progress>;
    if (p.dayIndex !== dayIndex) {
      return { dayIndex, found: [], bonus: [], finalized: false };
    }
    return {
      dayIndex,
      found: Array.isArray(p.found) ? p.found.filter((s) => typeof s === "string") : [],
      bonus: Array.isArray(p.bonus) ? p.bonus.filter((s) => typeof s === "string") : [],
      finalized: Boolean(p.finalized),
    };
  } catch {
    return { dayIndex, found: [], bonus: [], finalized: false };
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
   Misc helpers
   ============================================================ */

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* ============================================================
   Crossword grid
   ------------------------------------------------------------
   Renders a sparse rows×cols grid. Cells without a letter are
   transparent placeholders (so the rest of the layout still
   aligns); cells with a letter render an empty tile until any
   word containing that cell has been found, after which the
   letter is revealed with a flip animation. A cell is revealed
   if ANY of the words passing through it is in `foundSet`.
   ============================================================ */

function Crossword({
  puzzle,
  foundSet,
  justFoundWordIdx,
}: {
  puzzle: Puzzle;
  foundSet: Set<string>;
  justFoundWordIdx: number | null;
}) {
  const { rows, cols } = useMemo(() => gridBounds(puzzle), [puzzle]);
  const cells = useMemo(() => gridCells(puzzle), [puzzle]);

  // Map word index → whether that word has been found, for quick lookup.
  const foundByIdx = useMemo(() => {
    return puzzle.words.map((w) => foundSet.has(w.word));
  }, [puzzle.words, foundSet]);

  const tilePx = cols >= 7 ? 30 : cols >= 6 ? 34 : 38;
  const gapPx = 4;

  return (
    <div className="flex justify-center mb-4">
      <div
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
          const revealed = cell.wordIdx.some((i) => foundByIdx[i]);
          const flashing =
            justFoundWordIdx !== null && cell.wordIdx.includes(justFoundWordIdx);
          return (
            <CrossTile
              key={k}
              letter={cell.letter}
              revealed={revealed}
              flashing={flashing}
              size={tilePx}
            />
          );
        })}
      </div>
    </div>
  );
}

function CrossTile({
  letter,
  revealed,
  flashing,
  size,
}: {
  letter: string;
  revealed: boolean;
  flashing: boolean;
  size: number;
}) {
  return (
    <div
      role="gridcell"
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-sm)",
        background: revealed
          ? "color-mix(in oklab, var(--brand) 75%, var(--surface))"
          : "var(--surface-2)",
        border: revealed
          ? "1px solid color-mix(in oklab, var(--brand) 60%, transparent)"
          : "1px solid var(--border)",
        color: revealed ? "var(--brand-fg)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: size * 0.5,
        textTransform: "uppercase",
        lineHeight: 1,
        letterSpacing: "0.02em",
        transition: "background 200ms var(--ease-out), color 200ms var(--ease-out)",
        animation: flashing ? "wordPulse 0.6s var(--ease-out)" : undefined,
      }}
    >
      {revealed ? letter : ""}
    </div>
  );
}

/* ============================================================
   Letter wheel
   ------------------------------------------------------------
   N letters arranged on a circle. The user presses on a letter
   and drags through neighbours to chain them into a word; on
   pointer-up the chain is submitted. Hit-testing is in SVG
   coordinates so it works across phones, tablets, and desktop
   mice with the same code path.

   `selection` is an array of letter indices (into the supplied
   `letters` array) representing the current chain. A letter
   may not appear twice in one selection.
   ============================================================ */

const WHEEL_VIEWBOX = 280;
const WHEEL_CENTER = WHEEL_VIEWBOX / 2;
const WHEEL_RING_R = 100;
const WHEEL_LETTER_R = 26;
// How close (px in viewBox) the pointer must be to a letter's centre to
// register a hit. Generous enough that swiping across letters always works.
const HIT_RADIUS = WHEEL_LETTER_R + 6;

function letterPositions(n: number): { x: number; y: number }[] {
  // First letter at the top, going clockwise.
  return Array.from({ length: n }, (_, i) => {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      x: WHEEL_CENTER + WHEEL_RING_R * Math.cos(theta),
      y: WHEEL_CENTER + WHEEL_RING_R * Math.sin(theta),
    };
  });
}

function LetterWheel({
  letters,
  selection,
  onSelectionChange,
  onSubmit,
  onShuffle,
}: {
  letters: string[];
  selection: number[];
  onSelectionChange: (next: number[]) => void;
  onSubmit: () => void;
  onShuffle: () => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  // Current pointer position (in viewBox coords) so the trailing line
  // follows the finger between letters.
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const positions = useMemo(() => letterPositions(letters.length), [letters.length]);

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WHEEL_VIEWBOX;
    const y = ((clientY - rect.top) / rect.height) * WHEEL_VIEWBOX;
    return { x, y };
  }, []);

  const hitLetter = useCallback(
    (vx: number, vy: number): number => {
      let best = -1;
      let bestDist = HIT_RADIUS;
      for (let i = 0; i < positions.length; i++) {
        const dx = positions[i].x - vx;
        const dy = positions[i].y - vy;
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    },
    [positions],
  );

  const updateSelectionFor = useCallback(
    (idx: number) => {
      if (idx < 0) return;
      // If the pointer comes back over the previous letter, allow
      // backtracking (Wordscapes does this — drag back to undo the last hop).
      if (selection.length >= 2 && selection[selection.length - 2] === idx) {
        onSelectionChange(selection.slice(0, -1));
        return;
      }
      if (selection.includes(idx)) return;
      onSelectionChange([...selection, idx]);
    },
    [onSelectionChange, selection],
  );

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const v = toViewBox(e.clientX, e.clientY);
    if (!v) return;
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture not supported in some test envs */
    }
    setPointer(v);
    const idx = hitLetter(v.x, v.y);
    if (idx >= 0) {
      onSelectionChange([idx]);
    } else {
      onSelectionChange([]);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const v = toViewBox(e.clientX, e.clientY);
    if (!v) return;
    setPointer(v);
    const idx = hitLetter(v.x, v.y);
    if (idx >= 0) updateSelectionFor(idx);
  };

  const finishDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
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

  // Build the SVG polyline points: every selected letter centre, plus the
  // current pointer position so the trailing segment tracks the finger.
  // `pointer` is only non-null mid-drag (cleared in finishDrag), so its
  // presence is sufficient — no need to read draggingRef during render.
  const linePoints = useMemo(() => {
    const pts = selection.map((i) => `${positions[i].x},${positions[i].y}`);
    if (pointer) {
      pts.push(`${pointer.x},${pointer.y}`);
    }
    return pts.join(" ");
  }, [positions, selection, pointer]);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WHEEL_VIEWBOX} ${WHEEL_VIEWBOX}`}
        width={WHEEL_VIEWBOX}
        height={WHEEL_VIEWBOX}
        style={{
          maxWidth: "min(86vw, 320px)",
          touchAction: "none",
          userSelect: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={(e) => {
          // Release capture only on cancel — we DON'T submit here, since
          // pointer-leave fires while the drag is still in progress on
          // some browsers. Pointer-up handles submission.
          if (!draggingRef.current) return;
          // Keep tracking outside the SVG.
          const v = toViewBox(e.clientX, e.clientY);
          if (v) setPointer(v);
        }}
        role="application"
        aria-label="Letter wheel"
      >
        {/* Hub */}
        <circle
          cx={WHEEL_CENTER}
          cy={WHEEL_CENTER}
          r={WHEEL_RING_R + WHEEL_LETTER_R + 8}
          fill="var(--surface-2)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        {/* Selection trail */}
        {selection.length > 0 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={6}
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
                fill={selected ? "var(--brand)" : "var(--surface)"}
                stroke={selected ? "var(--brand)" : "var(--border-strong)"}
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={WHEEL_LETTER_R}
                fontWeight={800}
                fill={selected ? "var(--brand-fg)" : "var(--text)"}
                style={{ textTransform: "uppercase", pointerEvents: "none" }}
              >
                {letters[i].toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      <button
        type="button"
        onClick={onShuffle}
        className="btn btn-secondary btn-sm"
        aria-label="Shuffle letters"
      >
        Shuffle
      </button>
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */

type FlashKind = "found" | "bonus" | "duplicate" | "invalid" | "tooshort";
type Flash = { kind: FlashKind; word: string; coins?: number };

export default function WordClient({ playerName }: { playerName: string }) {
  const stats = useSyncExternalStore(subscribeStats, getStatsSnapshot, getStatsServer);

  const [today] = useState(() => {
    const ts = Date.now();
    return { dayIndex: utcDayIndex(ts), puzzle: puzzleForDay(ts) };
  });

  // Wheel order is randomised per session for replay variety.
  const [wheelLetters, setWheelLetters] = useState<string[]>(() =>
    shuffle(today.puzzle.letters),
  );
  const reshuffle = useCallback(() => {
    setWheelLetters((prev) => {
      // Avoid an immediate identical shuffle on small letter sets.
      for (let attempt = 0; attempt < 4; attempt++) {
        const next = shuffle(prev);
        if (next.join("") !== prev.join("")) return next;
      }
      return shuffle(prev);
    });
  }, []);

  // Hydrate today's persisted progress in the lazy initialisers so we don't
  // setState() from an effect on mount (cascading-renders lint rule).
  const [foundWords, setFoundWords] = useState<Set<string>>(() => {
    const p = readProgress(today.dayIndex);
    return new Set(p.found);
  });
  const [foundBonus, setFoundBonus] = useState<Set<string>>(() => {
    const p = readProgress(today.dayIndex);
    return new Set(p.bonus);
  });
  const [selection, setSelection] = useState<number[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [justFoundWordIdx, setJustFoundWordIdx] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedRef = useRef(false);
  const finalizedRef = useRef<boolean>(readProgress(today.dayIndex).finalized);
  const earnedCoinsRef = useRef(0);

  // Persist progress whenever it changes.
  useEffect(() => {
    writeProgress({
      dayIndex: today.dayIndex,
      found: Array.from(foundWords),
      bonus: Array.from(foundBonus),
      finalized: finalizedRef.current,
    });
  }, [today.dayIndex, foundWords, foundBonus]);

  // Tick the countdown clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-clear flash messages.
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 1200);
    return () => window.clearTimeout(id);
  }, [flash]);

  // Auto-clear the "just found" pulse so the same word doesn't keep
  // re-animating on every re-render.
  useEffect(() => {
    if (justFoundWordIdx === null) return;
    const id = window.setTimeout(() => setJustFoundWordIdx(null), 700);
    return () => window.clearTimeout(id);
  }, [justFoundWordIdx]);

  const allFound = foundWords.size === today.puzzle.words.length;
  const totalScoreToday =
    foundWords.size * COINS_PER_PUZZLE_WORD +
    foundBonus.size * COINS_PER_BONUS_WORD +
    (allFound ? COINS_FULL_CLEAR_BONUS : 0);

  // The currently-spelled word, derived from the chained letter indices.
  const currentWord = useMemo(
    () => selection.map((i) => wheelLetters[i]).join(""),
    [selection, wheelLetters],
  );

  /* ----- finalize: send the score to the server once today is done ----- */

  const finalize = useCallback(
    (solved: boolean) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;

      const score = totalScoreToday;
      earnedCoinsRef.current = score;

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
      writeProgress({
        dayIndex: today.dayIndex,
        found: Array.from(foundWords),
        bonus: Array.from(foundBonus),
        finalized: true,
      });

      if (sessionIdRef.current) {
        const sid = sessionIdRef.current;
        sessionIdRef.current = null;
        finishGameSession(sid, score).then((r) => {
          if (r.ok) emitBalanceChange();
        });
      }
    },
    [totalScoreToday, today.dayIndex, foundWords, foundBonus],
  );

  // Auto-finalize the moment every grid word is found.
  useEffect(() => {
    if (allFound && !finalizedRef.current) {
      finalize(true);
    }
  }, [allFound, finalize]);

  /* ----- selection submit ----- */

  const submitSelection = useCallback(() => {
    if (selection.length === 0) return;
    const word = currentWord;
    setSelection([]);

    if (word.length < 3) {
      if (word.length > 0) setFlash({ kind: "tooshort", word });
      return;
    }

    if (!canFormWord(today.puzzle, word)) {
      setFlash({ kind: "invalid", word });
      return;
    }

    // Lazily kick off the server session on the first valid attempt.
    if (!sessionStartedRef.current && !finalizedRef.current) {
      sessionStartedRef.current = true;
      startGameSession("word").then((r) => {
        if (r.ok) sessionIdRef.current = r.sessionId;
      });
    }

    const puzzleIdx = isPuzzleWord(today.puzzle, word);
    if (puzzleIdx >= 0) {
      if (foundWords.has(word)) {
        setFlash({ kind: "duplicate", word });
        return;
      }
      setFoundWords((prev) => {
        const next = new Set(prev);
        next.add(word);
        return next;
      });
      setJustFoundWordIdx(puzzleIdx);
      setFlash({ kind: "found", word, coins: COINS_PER_PUZZLE_WORD });
      return;
    }

    if (isBonusWord(today.puzzle, word)) {
      if (foundBonus.has(word)) {
        setFlash({ kind: "duplicate", word });
        return;
      }
      setFoundBonus((prev) => {
        const next = new Set(prev);
        next.add(word);
        return next;
      });
      setFlash({ kind: "bonus", word, coins: COINS_PER_BONUS_WORD });
      return;
    }

    setFlash({ kind: "invalid", word });
  }, [currentWord, foundWords, foundBonus, selection.length, today.puzzle]);

  /* ----- render ----- */

  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const msUntilTomorrow = Math.max(0, (today.dayIndex + 1) * DAY_MS - now);
  const totalBonusKnown = today.puzzle.bonus.length;

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 lg:py-8">
      <header className="mb-5 lg:mb-6">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Word Game
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Swipe the letters to spell every word in the grid. Bonus words pay extra.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <MiniStat
          label="Words"
          value={`${foundWords.size}/${today.puzzle.words.length}`}
        />
        <MiniStat
          label="Bonus"
          value={`${foundBonus.size}/${totalBonusKnown}`}
        />
        <MiniStat label="Streak" value={stats.currentStreak} />
        <MiniStat label="Best" value={stats.bestStreak} />
      </div>

      {allFound && (
        <ResultBanner
          kind="won"
          title={`Solved it, ${firstName}!`}
          detail={
            <>
              <span>
                {foundWords.size} words · {foundBonus.size} bonus ·{" "}
              </span>
              <IconCoin
                size={13}
                style={{ display: "inline", verticalAlign: "middle" }}
              />
              <span> +{totalScoreToday} coins</span>
            </>
          }
          countdownMs={msUntilTomorrow}
        />
      )}

      {/* Crossword grid */}
      <Crossword
        puzzle={today.puzzle}
        foundSet={foundWords}
        justFoundWordIdx={justFoundWordIdx}
      />

      {/* Bonus dot row */}
      <BonusDots found={foundBonus.size} total={totalBonusKnown} />

      {/* Current selection / flash */}
      <div className="min-h-[40px] my-3 flex items-center justify-center">
        {flash ? <FlashPill flash={flash} /> : <SelectionPreview word={currentWord} />}
      </div>

      {/* Letter wheel */}
      <LetterWheel
        letters={wheelLetters}
        selection={selection}
        onSelectionChange={setSelection}
        onSubmit={submitSelection}
        onShuffle={reshuffle}
      />

      <style>{`
        @keyframes wordPulse {
          0%   { transform: scale(1);    filter: brightness(1); }
          40%  { transform: scale(1.12); filter: brightness(1.4); }
          100% { transform: scale(1);    filter: brightness(1); }
        }
        @keyframes wordFloat {
          0%   { opacity: 0; transform: translateY(6px); }
          15%  { opacity: 1; transform: translateY(0); }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Small UI bits
   ============================================================ */

function SelectionPreview({ word }: { word: string }) {
  if (!word) {
    return (
      <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
        Drag across the wheel to spell a word
      </span>
    );
  }
  return (
    <span
      className="px-3 py-1 rounded-full text-base font-bold tracking-wide"
      style={{
        background: "var(--surface-2)",
        color: "var(--text)",
        border: "1px solid var(--border-strong)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {word}
    </span>
  );
}

function FlashPill({ flash }: { flash: Flash }) {
  const { kind, word, coins } = flash;
  let bg = "var(--surface-2)";
  let fg = "var(--text)";
  let border = "var(--border-strong)";
  let prefix: React.ReactNode = null;
  let suffix: React.ReactNode = null;

  if (kind === "found") {
    bg = "var(--success-weak)";
    fg = "var(--success-fg)";
    border = "color-mix(in oklab, var(--success) 40%, transparent)";
    prefix = <IconSparkles size={14} />;
    suffix = coins ? (
      <>
        {" "}+ <IconCoin size={12} /> {coins}
      </>
    ) : null;
  } else if (kind === "bonus") {
    bg = "var(--brand-weak)";
    fg = "var(--brand-weak-fg)";
    border = "color-mix(in oklab, var(--brand) 40%, transparent)";
    prefix = <IconSparkles size={14} />;
    suffix = coins ? (
      <>
        {" "}+ <IconCoin size={12} /> {coins} (bonus)
      </>
    ) : (
      " (bonus)"
    );
  } else if (kind === "duplicate") {
    bg = "var(--surface-3)";
    fg = "var(--text-muted)";
  } else if (kind === "invalid") {
    bg = "var(--danger-weak)";
    fg = "var(--danger-fg)";
    border = "color-mix(in oklab, var(--danger) 40%, transparent)";
    prefix = <IconError size={14} />;
  } else if (kind === "tooshort") {
    bg = "var(--surface-3)";
    fg = "var(--text-muted)";
  }

  const label =
    kind === "duplicate"
      ? `Already found: ${word.toUpperCase()}`
      : kind === "tooshort"
        ? `Too short`
        : kind === "invalid"
          ? `Not a word`
          : word.toUpperCase();

  return (
    <span
      role="status"
      className="px-3 py-1.5 rounded-full text-sm font-semibold inline-flex items-center gap-1.5"
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        animation: "wordFloat 1.2s var(--ease-out) both",
      }}
    >
      {prefix}
      <span>{label}</span>
      {suffix}
    </span>
  );
}

function BonusDots({ found, total }: { found: number; total: number }) {
  // Cap the visual row so it doesn't overflow on long bonus lists; scale
  // the "filled" count proportionally if total is very large.
  const slots = Math.min(8, Math.max(4, total));
  const filled =
    total === 0 ? 0 : Math.min(slots, Math.round((found / total) * slots));
  return (
    <div className="flex items-center justify-center gap-1.5 my-2" aria-hidden>
      {Array.from({ length: slots }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: "var(--radius-full)",
            background: i < filled ? "var(--brand)" : "var(--surface-3)",
            border: "1px solid var(--border)",
          }}
        />
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-md flex flex-col items-center justify-center py-2"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="text-base font-bold leading-none"
        style={{ color: "var(--text)" }}
      >
        {value}
      </span>
      <span
        className="text-[10px] uppercase tracking-wider mt-1"
        style={{ color: "var(--text-subtle)" }}
      >
        {label}
      </span>
    </div>
  );
}

function ResultBanner({
  kind,
  title,
  detail,
  countdownMs,
}: {
  kind: "won" | "lost";
  title: string;
  detail: React.ReactNode;
  countdownMs: number;
}) {
  const isWin = kind === "won";
  return (
    <section
      className="card mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{
        background: isWin
          ? "linear-gradient(135deg, color-mix(in oklab, var(--brand-weak) 75%, transparent), var(--surface))"
          : "linear-gradient(135deg, color-mix(in oklab, var(--danger-weak) 75%, transparent), var(--surface))",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0"
        style={{
          background: isWin ? "var(--brand-weak)" : "var(--danger-weak)",
          color: isWin ? "var(--brand)" : "var(--danger-fg)",
        }}
      >
        {isWin ? <IconTrophy size={22} /> : <IconError size={22} />}
      </span>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
        <div
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-mono"
          style={{ color: "var(--text-subtle)" }}
        >
          <IconClock size={12} />
          Next puzzle in {formatCountdown(countdownMs)}
        </div>
      </div>
    </section>
  );
}
