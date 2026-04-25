"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { IconClock, IconCoin, IconError, IconTrophy } from "@/components/icons";
import { isValidGuess, utcDayIndex, wordForDay } from "./words";
import {
  startGameSession,
  finishGameSession,
  emitBalanceChange,
} from "@/lib/game-session";

/* ============================================================
   Config
   ============================================================ */

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

// Score table keyed by 1-based try count; tighter solves pay out steeply more.
const SCORE_BY_TRY: Record<number, number> = {
  1: 1500,
  2: 1000,
  3: 700,
  4: 450,
  5: 250,
  6: 100,
};

const STORAGE_KEY = "minero_word_stats_v1";
const DAY_MS = 24 * 60 * 60 * 1000;

type LetterState = "correct" | "present" | "absent";

type Stats = {
  totalCoins: number;
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  // Epoch day index of the last completed round (-1 if never).
  lastPlayedDay: number;
  // Whether the last round was a win.
  lastResult: "win" | "loss" | null;
  // Wins indexed by 1..MAX_GUESSES (index 0 unused for clarity).
  distribution: number[];
};

const EMPTY_STATS: Stats = {
  totalCoins: 0,
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDay: -1,
  lastResult: null,
  distribution: new Array(MAX_GUESSES + 1).fill(0),
};

function parseStats(raw: string | null): Stats {
  if (!raw) return EMPTY_STATS;
  try {
    const p = JSON.parse(raw) as Partial<Stats> & { totalPoints?: number };
    const dist = Array.isArray(p.distribution)
      ? p.distribution.slice(0, MAX_GUESSES + 1).map((n) => Number(n) || 0)
      : [];
    while (dist.length < MAX_GUESSES + 1) dist.push(0);
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
      lastResult: p.lastResult === "win" || p.lastResult === "loss" ? p.lastResult : null,
      distribution: dist,
    };
  } catch {
    return EMPTY_STATS;
  }
}

let cachedRaw: string | null = null;
let cachedStats: Stats = EMPTY_STATS;

function getSnapshot(): Stats {
  if (typeof window === "undefined") return EMPTY_STATS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = parseStats(raw);
  }
  return cachedStats;
}

function getServerSnapshot(): Stats {
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
function writeStats(next: Stats) {
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
   Grading
   Per-letter Wordle rules: a letter in the guess marked "present"
   only if the answer has an un-matched copy elsewhere. Duplicates
   in the guess that exceed the count in the answer fall through to
   "absent" after greens/yellows are assigned.
   ============================================================ */

function gradeGuess(guess: string, answer: string): LetterState[] {
  const out: LetterState[] = new Array(WORD_LENGTH).fill("absent");
  const counts: Record<string, number> = {};

  // First pass: exact matches (green) and count remaining answer letters.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      out[i] = "correct";
    } else {
      counts[answer[i]] = (counts[answer[i]] || 0) + 1;
    }
  }
  // Second pass: present (yellow) draws from remaining counts.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (out[i] === "correct") continue;
    const c = guess[i];
    if (counts[c] && counts[c] > 0) {
      out[i] = "present";
      counts[c]--;
    }
  }
  return out;
}

/** Best-state merge so the on-screen keyboard never regresses a key. */
function mergeKeyState(
  prev: Record<string, LetterState | undefined>,
  guess: string,
  grades: LetterState[],
): Record<string, LetterState | undefined> {
  const next = { ...prev };
  const rank: Record<LetterState, number> = { absent: 1, present: 2, correct: 3 };
  for (let i = 0; i < WORD_LENGTH; i++) {
    const c = guess[i];
    const incoming = grades[i];
    const existing = next[c];
    if (!existing || rank[incoming] > rank[existing]) {
      next[c] = incoming;
    }
  }
  return next;
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
   Main client
   ============================================================ */

const ROW_1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const ROW_2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
const ROW_3 = ["z", "x", "c", "v", "b", "n", "m"];

type Status = "playing" | "won" | "lost";

export default function WordClient({ playerName }: { playerName: string }) {
  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Answer is fixed per UTC day. We read it once on mount; no need to refresh
  // mid-session (if the clock rolls past midnight we keep the current puzzle
  // and let the next page load pick up the new day).
  const [today] = useState(() => ({
    dayIndex: utcDayIndex(Date.now()),
    answer: wordForDay(Date.now()),
  }));

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedRef = useRef(false);

  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [status, setStatus] = useState<Status>("playing");
  const [error, setError] = useState<string | null>(null);
  const [shakeRow, setShakeRow] = useState<number>(-1);
  const [now, setNow] = useState<number>(() => Date.now());
  const [finalScore, setFinalScore] = useState<number>(0);

  // If the user already completed today's word, rehydrate the lock screen.
  const alreadyFinishedToday = stats.lastPlayedDay === today.dayIndex;

  useEffect(() => {
    if (!alreadyFinishedToday) return;
    // Lock state — we don't preserve individual guesses across reloads, just
    // the final outcome. Show the summary screen.
    setStatus(stats.lastResult === "win" ? "won" : "lost");
  }, [alreadyFinishedToday, stats.lastResult]);

  useEffect(() => {
    if (status === "playing") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Key state across all guesses so we can color the virtual keyboard.
  const keyState = useMemo(() => {
    let acc: Record<string, LetterState | undefined> = {};
    for (const g of guesses) {
      acc = mergeKeyState(acc, g, gradeGuess(g, today.answer));
    }
    return acc;
  }, [guesses, today.answer]);

  const errorTimeoutRef = useRef<number | null>(null);
  const flashError = useCallback(
    (msg: string) => {
      setError(msg);
      setShakeRow(guesses.length);
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = window.setTimeout(() => {
        setError(null);
        setShakeRow(-1);
        errorTimeoutRef.current = null;
      }, 1200);
    },
    [guesses.length],
  );

  const finalize = useCallback(
    (allGuesses: string[], outcome: "win" | "loss") => {
      const tryCount = allGuesses.length;
      const score = outcome === "win" ? (SCORE_BY_TRY[tryCount] ?? 0) : 0;
      setFinalScore(score);
      setStatus(outcome === "win" ? "won" : "lost");

      const prev = getSnapshot();
      // Streak logic: a miss resets the streak, a win extends it.
      const nextStreak = outcome === "win" ? prev.currentStreak + 1 : 0;
      const nextDistribution = [...prev.distribution];
      if (outcome === "win") {
        nextDistribution[tryCount] = (nextDistribution[tryCount] || 0) + 1;
      }

      writeStats({
        totalCoins: prev.totalCoins + score,
        gamesPlayed: prev.gamesPlayed + 1,
        wins: prev.wins + (outcome === "win" ? 1 : 0),
        currentStreak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
        lastPlayedDay: today.dayIndex,
        lastResult: outcome,
        distribution: nextDistribution,
      });
      if (sessionIdRef.current) {
        const sid = sessionIdRef.current;
        sessionIdRef.current = null;
        finishGameSession(sid, score).then((r) => {
          if (r.ok) emitBalanceChange();
        });
      }
    },
    [today.dayIndex],
  );

  const submitGuess = useCallback(() => {
    if (status !== "playing") return;
    if (alreadyFinishedToday) return;
    if (current.length !== WORD_LENGTH) {
      flashError("Need 5 letters");
      return;
    }
    if (!isValidGuess(current)) {
      flashError("Not in word list");
      return;
    }
    // Start server session on the first valid guess.
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      startGameSession("word").then((r) => {
        if (r.ok) sessionIdRef.current = r.sessionId;
      });
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent("");

    if (current === today.answer) {
      finalize(next, "win");
    } else if (next.length >= MAX_GUESSES) {
      finalize(next, "loss");
    }
  }, [
    alreadyFinishedToday,
    current,
    finalize,
    flashError,
    guesses,
    status,
    today.answer,
  ]);

  const pressLetter = useCallback(
    (ch: string) => {
      if (status !== "playing" || alreadyFinishedToday) return;
      if (current.length >= WORD_LENGTH) return;
      setCurrent((c) => c + ch.toLowerCase());
      setError(null);
    },
    [alreadyFinishedToday, current.length, status],
  );
  const pressBackspace = useCallback(() => {
    if (status !== "playing" || alreadyFinishedToday) return;
    setCurrent((c) => c.slice(0, -1));
    setError(null);
  }, [alreadyFinishedToday, status]);

  // Physical keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuess();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        pressBackspace();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        pressLetter(e.key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressBackspace, pressLetter, submitGuess]);

  // Derived rows for rendering
  const rows = useMemo(() => {
    const rendered: {
      chars: string[];
      grades: (LetterState | "pending")[];
      filled: boolean;
    }[] = [];
    for (let i = 0; i < MAX_GUESSES; i++) {
      const guess = guesses[i];
      if (guess) {
        rendered.push({
          chars: guess.split(""),
          grades: gradeGuess(guess, today.answer),
          filled: true,
        });
      } else if (i === guesses.length && status === "playing") {
        const chars = current.split("");
        while (chars.length < WORD_LENGTH) chars.push("");
        rendered.push({
          chars,
          grades: new Array(WORD_LENGTH).fill("pending"),
          filled: false,
        });
      } else {
        rendered.push({
          chars: new Array(WORD_LENGTH).fill(""),
          grades: new Array(WORD_LENGTH).fill("pending"),
          filled: false,
        });
      }
    }
    return rendered;
  }, [current, guesses, status, today.answer]);

  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const msUntilTomorrow = Math.max(
    0,
    (today.dayIndex + 1) * DAY_MS - now,
  );
  const winRatePct = stats.gamesPlayed
    ? Math.round((stats.wins / stats.gamesPlayed) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 lg:py-8">
      <header className="mb-5 lg:mb-6">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Word Game
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Guess the day&apos;s 5-letter word in six tries. Fewer tries pay more.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <MiniStat label="Played" value={stats.gamesPlayed} />
        <MiniStat label="Win %" value={`${winRatePct}`} />
        <MiniStat label="Streak" value={stats.currentStreak} />
        <MiniStat label="Best" value={stats.bestStreak} />
      </div>

      {/* Result banner */}
      {status === "won" && (
        <ResultBanner
          kind="won"
          title={`Nailed it, ${firstName}!`}
          detail={
            alreadyFinishedToday && finalScore === 0
              ? `You solved today's word — come back tomorrow for a fresh one.`
              : <><span>Solved in {guesses.length} {guesses.length === 1 ? "try" : "tries"} · </span><IconCoin size={13} style={{ display: "inline", verticalAlign: "middle" }} /><span> +{finalScore} coins</span></>
          }
          countdownMs={msUntilTomorrow}
        />
      )}
      {status === "lost" && (
        <ResultBanner
          kind="lost"
          title="Out of tries"
          detail={`Today's word was "${today.answer.toUpperCase()}". Fresh one in…`}
          countdownMs={msUntilTomorrow}
        />
      )}

      {/* Error pill */}
      <div className="min-h-[24px] mb-2 flex items-center justify-center">
        {error && (
          <span
            role="alert"
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--danger-weak)",
              color: "var(--danger-fg)",
              border:
                "1px solid color-mix(in oklab, var(--danger) 35%, transparent)",
            }}
          >
            {error}
          </span>
        )}
      </div>

      {/* Board */}
      <div
        className="mx-auto grid gap-1.5 mb-5"
        style={{
          gridTemplateRows: `repeat(${MAX_GUESSES}, 1fr)`,
          maxWidth: `calc(${WORD_LENGTH} * 58px + ${WORD_LENGTH - 1} * 6px)`,
        }}
        role="grid"
        aria-label="Word board"
      >
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${WORD_LENGTH}, 1fr)`,
              animation:
                shakeRow === i ? "wordShake 0.3s var(--ease-out)" : undefined,
            }}
          >
            {row.chars.map((ch, j) => (
              <LetterTile
                key={j}
                ch={ch}
                state={row.grades[j]}
                filled={row.filled}
                revealDelayMs={row.filled ? j * 90 : 0}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Keyboard */}
      <div className="flex flex-col gap-1.5 select-none">
        <KeyboardRow letters={ROW_1} keyState={keyState} onLetter={pressLetter} />
        <KeyboardRow letters={ROW_2} keyState={keyState} onLetter={pressLetter} />
        <div className="flex gap-1.5 justify-center">
          <KeyButton wide onClick={submitGuess} label="Enter" />
          {ROW_3.map((l) => (
            <KeyButton
              key={l}
              onClick={() => pressLetter(l)}
              label={l}
              state={keyState[l]}
            />
          ))}
          <KeyButton wide onClick={pressBackspace} label="⌫" />
        </div>
      </div>

      {/* Local CSS for tile flip + shake */}
      <style>{`
        @keyframes wordShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
        }
        @keyframes wordFlip {
          0% { transform: rotateX(0deg); }
          49% { transform: rotateX(90deg); }
          50% { transform: rotateX(90deg); }
          100% { transform: rotateX(0deg); }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Tile
   ============================================================ */

function LetterTile({
  ch,
  state,
  filled,
  revealDelayMs,
}: {
  ch: string;
  state: LetterState | "pending";
  filled: boolean;
  revealDelayMs: number;
}) {
  const graded = filled && state !== "pending";
  const bg =
    graded && state === "correct"
      ? "var(--success)"
      : graded && state === "present"
        ? "var(--warning)"
        : graded && state === "absent"
          ? "var(--surface-3)"
          : "var(--surface)";
  const color =
    graded && state === "correct"
      ? "#0b1a10"
      : graded && state === "present"
        ? "#2a1f04"
        : "var(--text)";
  const border = ch
    ? "var(--border-strong)"
    : "var(--border)";

  return (
    <div
      role="gridcell"
      style={{
        aspectRatio: "1 / 1",
        border: `1px solid ${graded ? "transparent" : border}`,
        borderRadius: "var(--radius-sm)",
        background: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 800,
        fontSize: "1.4rem",
        textTransform: "uppercase",
        lineHeight: 1,
        letterSpacing: "0.02em",
        animation: graded
          ? `wordFlip 0.5s var(--ease-out) ${revealDelayMs}ms both`
          : undefined,
      }}
    >
      {ch}
    </div>
  );
}

/* ============================================================
   Keyboard
   ============================================================ */

function KeyboardRow({
  letters,
  keyState,
  onLetter,
}: {
  letters: string[];
  keyState: Record<string, LetterState | undefined>;
  onLetter: (ch: string) => void;
}) {
  return (
    <div className="flex gap-1.5 justify-center">
      {letters.map((l) => (
        <KeyButton
          key={l}
          onClick={() => onLetter(l)}
          label={l}
          state={keyState[l]}
        />
      ))}
    </div>
  );
}

function KeyButton({
  onClick,
  label,
  state,
  wide,
}: {
  onClick: () => void;
  label: string;
  state?: LetterState;
  wide?: boolean;
}) {
  const bg =
    state === "correct"
      ? "var(--success)"
      : state === "present"
        ? "var(--warning)"
        : state === "absent"
          ? "var(--surface-3)"
          : "var(--surface-2)";
  const color =
    state === "correct"
      ? "#0b1a10"
      : state === "present"
        ? "#2a1f04"
        : state === "absent"
          ? "var(--text-subtle)"
          : "var(--text)";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: wide ? "1.5 1 0" : "1 1 0",
        minWidth: wide ? 52 : 0,
        height: 52,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: bg,
        color,
        fontSize: "var(--fs-14)",
        fontWeight: 700,
        textTransform: "uppercase",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

/* ============================================================
   Small stat tile + result banner
   ============================================================ */

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
        className="text-lg font-bold leading-none"
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
          Next word in {formatCountdown(countdownMs)}
        </div>
      </div>
    </section>
  );
}
