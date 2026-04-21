"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  IconGame,
  IconTrophy,
  IconBrain,
  IconBoltSmall,
  IconCheck,
  IconError,
  IconClock,
  IconSparkles,
  IconArrowRight,
} from "@/components/icons";
import {
  TRIVIA_QUESTIONS,
  pickRandomQuestions,
  type TriviaDifficulty,
  type TriviaQuestion,
} from "./questions";

type Stage = "idle" | "playing" | "reveal" | "done";

type Stats = {
  bestScore: number;
  totalPoints: number;
  gamesPlayed: number;
  totalCorrect: number;
};

const STORAGE_KEY = "minero_trivia_stats_v1";
const QUESTIONS_PER_ROUND = 10;
const SECONDS_PER_QUESTION = 15;
const BASE_POINTS = 10;

const DIFFICULTY_MULT: Record<TriviaDifficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

const EMPTY_STATS: Stats = {
  bestScore: 0,
  totalPoints: 0,
  gamesPlayed: 0,
  totalCorrect: 0,
};

function parseStats(raw: string | null): Stats {
  if (!raw) return EMPTY_STATS;
  try {
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      bestScore: Number(parsed.bestScore) || 0,
      totalPoints: Number(parsed.totalPoints) || 0,
      gamesPlayed: Number(parsed.gamesPlayed) || 0,
      totalCorrect: Number(parsed.totalCorrect) || 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

// Cached snapshot string so useSyncExternalStore gets a stable reference.
let cachedRaw: string | null = null;
let cachedStats: Stats = EMPTY_STATS;

function getStatsSnapshot(): Stats {
  if (typeof window === "undefined") return EMPTY_STATS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = parseStats(raw);
  }
  return cachedStats;
}

function getStatsServerSnapshot(): Stats {
  return EMPTY_STATS;
}

const statsListeners = new Set<() => void>();

function subscribeStats(cb: () => void) {
  statsListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedStats = parseStats(cachedRaw);
    statsListeners.forEach((cb) => cb());
  } catch {
    /* quota / private mode */
  }
}

function scoreForQuestion(
  q: TriviaQuestion,
  secondsLeft: number,
  streak: number,
) {
  const difficultyBonus = DIFFICULTY_MULT[q.difficulty] ?? 1;
  const speedBonus = Math.max(0, secondsLeft) / SECONDS_PER_QUESTION; // 0..1
  const base = BASE_POINTS * difficultyBonus;
  const withSpeed = base + base * speedBonus; // up to 2x on instant answer
  const streakBonus = streak >= 3 ? 5 * (streak - 2) : 0;
  return Math.round(withSpeed + streakBonus);
}

export default function GameClient({ playerName }: { playerName: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const stats = useSyncExternalStore(
    subscribeStats,
    getStatsSnapshot,
    getStatsServerSnapshot,
  );
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION);
  const [lastDelta, setLastDelta] = useState(0);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = questions.length || QUESTIONS_PER_ROUND;
  const current = questions[index];

  const clearTimers = useCallback(() => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
  }, []);

  const startGame = useCallback(() => {
    clearTimers();
    setQuestions(pickRandomQuestions(QUESTIONS_PER_ROUND));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setSecondsLeft(SECONDS_PER_QUESTION);
    setLastDelta(0);
    setStage("playing");
  }, [clearTimers]);

  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);

  const advance = useCallback(() => {
    clearTimers();
    const nextIdx = index + 1;
    if (nextIdx >= questions.length) {
      const prev = getStatsSnapshot();
      writeStats({
        bestScore: Math.max(prev.bestScore, scoreRef.current),
        totalPoints: prev.totalPoints + scoreRef.current,
        gamesPlayed: prev.gamesPlayed + 1,
        totalCorrect: prev.totalCorrect + correctRef.current,
      });
      setStage("done");
      return;
    }
    setIndex(nextIdx);
    setPicked(null);
    setSecondsLeft(SECONDS_PER_QUESTION);
    setStage("playing");
  }, [clearTimers, index, questions.length]);

  const submit = useCallback(
    (choice: number | null) => {
      if (!current || stage !== "playing") return;
      clearTimers();
      setPicked(choice);
      const isCorrect = choice !== null && choice === current.answer;
      if (isCorrect) {
        const delta = scoreForQuestion(current, secondsLeft, streak + 1);
        setScore((s) => s + delta);
        setCorrect((c) => c + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => (next > b ? next : b));
          return next;
        });
        setLastDelta(delta);
      } else {
        setStreak(0);
        setLastDelta(0);
      }
      setStage("reveal");
      revealTimer.current = setTimeout(() => advance(), 1400);
    },
    [advance, clearTimers, current, secondsLeft, stage, streak],
  );

  // Countdown for active question
  useEffect(() => {
    if (stage !== "playing") return;
    tickTimer.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Time's up — auto-submit a miss
          submit(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tickTimer.current) {
        clearInterval(tickTimer.current);
        tickTimer.current = null;
      }
    };
  }, [stage, index, submit]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
  }, []);

  // Keyboard shortcuts: 1-4 to answer, Enter to start/continue
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (stage === "idle" && e.key === "Enter") {
        startGame();
      } else if (stage === "playing" && current) {
        const n = Number(e.key);
        if (n >= 1 && n <= current.options.length) {
          submit(n - 1);
        }
      } else if (stage === "done" && e.key === "Enter") {
        startGame();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, current, startGame, submit]);

  return (
    <div className="w-full">
      {stage === "idle" && <IdleView playerName={playerName} stats={stats} onStart={startGame} />}

      {(stage === "playing" || stage === "reveal") && current && (
        <PlayingView
          question={current}
          index={index}
          total={total}
          secondsLeft={secondsLeft}
          score={score}
          streak={streak}
          picked={picked}
          stage={stage}
          onPick={submit}
          onSkip={() => submit(null)}
          onNext={advance}
          lastDelta={lastDelta}
        />
      )}

      {stage === "done" && (
        <DoneView
          score={score}
          correct={correct}
          total={total}
          bestStreak={bestStreak}
          stats={stats}
          onReplay={startGame}
        />
      )}
    </div>
  );
}

/* ============================================================
   Idle / welcome
   ============================================================ */
function IdleView({
  playerName,
  stats,
  onStart,
}: {
  playerName: string;
  stats: Stats;
  onStart: () => void;
}) {
  const firstName = playerName?.split(/\s+/)[0] || "Miner";

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 lg:mb-8">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Trivia Quiz</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          10 questions. 15 seconds each. Answer fast, build streaks, rack up game points.
        </p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="kpi">
          <span className="kpi-label">Best score</span>
          <span className="kpi-value kpi-value-brand">{stats.bestScore}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Total points</span>
          <span className="kpi-value">{stats.totalPoints}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Games played</span>
          <span className="kpi-value">{stats.gamesPlayed}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Correct answers</span>
          <span className="kpi-value">{stats.totalCorrect}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Hero card */}
        <section
          className="card"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--brand-weak) 80%, transparent), var(--surface))",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
            >
              <IconGame size={22} />
            </span>
            <div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Ready, {firstName}?
              </div>
              <div className="font-semibold text-lg">Earn game points by answering fast</div>
            </div>
          </div>
          <ul className="text-sm flex flex-col gap-2 mb-4" style={{ color: "var(--text-muted)" }}>
            <li className="flex items-start gap-2">
              <IconBoltSmall size={16} />
              <span>Correct + fast answers score more — the timer matters.</span>
            </li>
            <li className="flex items-start gap-2">
              <IconSparkles size={16} />
              <span>Streak bonus kicks in at 3 in a row and grows from there.</span>
            </li>
            <li className="flex items-start gap-2">
              <IconTrophy size={16} />
              <span>Your best score and totals are saved on this device.</span>
            </li>
          </ul>
          <button onClick={onStart} className="btn btn-primary btn-lg w-full lg:w-auto">
            <IconGame size={18} /> Start quiz
            <span className="hidden xl:inline-flex gap-1 ml-2" aria-hidden>
              <kbd>Enter</kbd>
            </span>
          </button>
        </section>

        {/* How it works */}
        <aside className="card">
          <div className="section-title mb-3">How scoring works</div>
          <ol className="flex flex-col gap-3 text-sm">
            {[
              `Base ${BASE_POINTS} points per correct answer.`,
              "Easy ×1 · Medium ×1.5 · Hard ×2 difficulty multiplier.",
              "Speed bonus — up to +100% for instant answers.",
              "+5 per streak step beyond 3 in a row.",
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                  style={{ background: "var(--brand-weak)", color: "var(--brand-weak-fg)" }}
                >
                  {i + 1}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{step}</span>
              </li>
            ))}
          </ol>
          <div
            className="mt-4 text-xs"
            style={{ color: "var(--text-subtle)" }}
          >
            Pool of {TRIVIA_QUESTIONS.length} questions across Geography, Science, Tech, History,
            Entertainment, Sports, Math, Food and more.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Playing / reveal
   ============================================================ */
function PlayingView({
  question,
  index,
  total,
  secondsLeft,
  score,
  streak,
  picked,
  stage,
  onPick,
  onSkip,
  onNext,
  lastDelta,
}: {
  question: TriviaQuestion;
  index: number;
  total: number;
  secondsLeft: number;
  score: number;
  streak: number;
  picked: number | null;
  stage: Stage;
  onPick: (choice: number) => void;
  onSkip: () => void;
  onNext: () => void;
  lastDelta: number;
}) {
  const progressPct = ((index + (stage === "reveal" ? 1 : 0)) / total) * 100;
  const timerPct = (secondsLeft / SECONDS_PER_QUESTION) * 100;
  const timerLow = secondsLeft <= 5;
  const revealed = stage === "reveal";
  const isCorrectAnswer = revealed && picked === question.answer;
  const missed = revealed && picked === null;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 lg:px-8 lg:py-8">
      {/* Top meta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`badge badge-${question.difficulty === "hard" ? "rejected" : question.difficulty === "medium" ? "pending" : "approved"}`}>
            {question.difficulty}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {question.category}
          </span>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--text-subtle)" }}>
          Q {index + 1} / {total}
        </div>
      </div>

      {/* Progress */}
      <div className="progress mb-4" aria-label="Quiz progress">
        <div
          className="progress-bar is-success"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Score / streak / timer */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="kpi" style={{ padding: "0.75rem" }}>
          <span className="kpi-label">Score</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {score}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.75rem" }}>
          <span className="kpi-label">Streak</span>
          <span
            className="kpi-value"
            style={{
              fontSize: "var(--fs-20)",
              color: streak >= 3 ? "var(--brand)" : "var(--text)",
            }}
          >
            {streak}×
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.75rem" }}>
          <span className="kpi-label">Time</span>
          <span
            className="kpi-value flex items-center gap-1"
            style={{
              fontSize: "var(--fs-20)",
              color: timerLow ? "var(--danger-fg)" : "var(--text)",
            }}
          >
            <IconClock size={14} />
            {secondsLeft}s
          </span>
        </div>
      </div>

      {/* Timer bar */}
      <div className="progress mb-5" aria-label="Time remaining">
        <div
          className="progress-bar"
          style={{
            width: `${timerPct}%`,
            background: timerLow ? "var(--danger)" : "var(--brand)",
            transition: "width 1s linear",
          }}
        />
      </div>

      {/* Question */}
      <section className="card mb-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
          >
            <IconBrain size={18} />
          </span>
          <h2 className="text-lg lg:text-xl font-semibold leading-snug">
            {question.question}
          </h2>
        </div>
      </section>

      {/* Options */}
      <div className="grid gap-2.5 mb-4">
        {question.options.map((opt, i) => {
          const isPicked = picked === i;
          const isAnswer = i === question.answer;
          const showCorrect = revealed && isAnswer;
          const showWrong = revealed && isPicked && !isAnswer;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              disabled={revealed}
              aria-pressed={isPicked}
              className="text-left flex items-center gap-3 px-4 py-3.5 rounded-lg border transition"
              style={{
                background: showCorrect
                  ? "var(--success-weak)"
                  : showWrong
                  ? "var(--danger-weak)"
                  : isPicked
                  ? "var(--brand-weak)"
                  : "var(--surface)",
                borderColor: showCorrect
                  ? "color-mix(in oklab, var(--success) 40%, transparent)"
                  : showWrong
                  ? "color-mix(in oklab, var(--danger) 40%, transparent)"
                  : isPicked
                  ? "color-mix(in oklab, var(--brand) 40%, transparent)"
                  : "var(--border)",
                color: showCorrect
                  ? "var(--success-fg)"
                  : showWrong
                  ? "var(--danger-fg)"
                  : "var(--text)",
                cursor: revealed ? "default" : "pointer",
              }}
            >
              <span
                aria-hidden
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-sm font-semibold"
                style={{
                  background:
                    showCorrect || showWrong
                      ? "transparent"
                      : "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "inherit",
                }}
              >
                {showCorrect ? (
                  <IconCheck size={14} />
                ) : showWrong ? (
                  <IconError size={14} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="flex-1 text-sm lg:text-base font-medium">{opt}</span>
              <kbd className="hidden md:inline-flex">{i + 1}</kbd>
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          {revealed ? (
            isCorrectAnswer ? (
              <span style={{ color: "var(--success-fg)" }}>
                +{lastDelta} points {streak >= 3 ? `· ${streak}× streak 🔥` : ""}
              </span>
            ) : missed ? (
              <span style={{ color: "var(--warning-fg)" }}>Time&rsquo;s up — no points.</span>
            ) : (
              <span style={{ color: "var(--danger-fg)" }}>Wrong — streak reset.</span>
            )
          ) : (
            <>Press 1–4 to answer. You can skip if stuck.</>
          )}
        </div>
        {revealed ? (
          <button onClick={onNext} className="btn btn-primary">
            {index + 1 >= total ? "See results" : "Next"}
            <IconArrowRight size={16} />
          </button>
        ) : (
          <button onClick={onSkip} className="btn btn-ghost">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Done / results
   ============================================================ */
function DoneView({
  score,
  correct,
  total,
  bestStreak,
  stats,
  onReplay,
}: {
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  stats: Stats;
  onReplay: () => void;
}) {
  const pct = Math.round((correct / total) * 100);
  const isNewBest = score > 0 && score >= stats.bestScore;

  const title = useMemo(() => {
    if (pct === 100) return "Flawless!";
    if (pct >= 80) return "Great run";
    if (pct >= 50) return "Not bad";
    if (pct >= 20) return "Keep practicing";
    return "Tough round";
  }, [pct]);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 lg:px-8 lg:py-10">
      <section
        className="card text-center"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--brand-weak) 60%, transparent), var(--surface))",
        }}
      >
        <span
          aria-hidden
          className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-3"
          style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
        >
          <IconTrophy size={26} />
        </span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          You got {correct} of {total} correct.
        </p>

        <div
          className="font-mono font-bold mt-5"
          style={{ fontSize: "var(--fs-48)", color: "var(--brand)", lineHeight: 1 }}
        >
          {score}
        </div>
        <div className="text-xs mb-4" style={{ color: "var(--text-subtle)" }}>
          points earned{isNewBest ? " · new personal best!" : ""}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="kpi" style={{ padding: "0.75rem" }}>
            <span className="kpi-label">Accuracy</span>
            <span className="kpi-value" style={{ fontSize: "var(--fs-18)" }}>
              {pct}%
            </span>
          </div>
          <div className="kpi" style={{ padding: "0.75rem" }}>
            <span className="kpi-label">Best streak</span>
            <span
              className="kpi-value"
              style={{
                fontSize: "var(--fs-18)",
                color: bestStreak >= 3 ? "var(--brand)" : "var(--text)",
              }}
            >
              {bestStreak}×
            </span>
          </div>
          <div className="kpi" style={{ padding: "0.75rem" }}>
            <span className="kpi-label">All-time best</span>
            <span className="kpi-value" style={{ fontSize: "var(--fs-18)" }}>
              {Math.max(stats.bestScore, score)}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={onReplay} className="btn btn-primary btn-lg">
            <IconGame size={18} /> Play again
            <span className="hidden md:inline-flex gap-1 ml-2" aria-hidden>
              <kbd>Enter</kbd>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
