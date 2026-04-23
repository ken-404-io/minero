"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  IconArrowRight,
  IconClock,
  IconCoin,
  IconError,
  IconFlag,
  IconMine,
  IconSparkles,
  IconTrophy,
} from "@/components/icons";

/* ============================================================
   Difficulty config
   ============================================================ */

type Difficulty = "easy" | "medium" | "hard";

type DifficultySpec = {
  id: Difficulty;
  label: string;
  cols: number;
  rows: number;
  mines: number;
  multiplier: number;
};

const DIFFICULTIES: Record<Difficulty, DifficultySpec> = {
  easy: { id: "easy", label: "Easy", cols: 8, rows: 8, mines: 10, multiplier: 1 },
  medium: {
    id: "medium",
    label: "Medium",
    cols: 10,
    rows: 10,
    mines: 20,
    multiplier: 1.5,
  },
  hard: {
    id: "hard",
    label: "Hard",
    cols: 12,
    rows: 12,
    mines: 30,
    multiplier: 2,
  },
};

const SCORE_BASE = 1500;
const SCORE_TIME_PENALTY = 2;

/* ============================================================
   Persisted stats
   ============================================================ */

type DiffStats = { gamesWon: number; bestTimeMs: number };

type MinesweeperStats = {
  totalCoins: number;
  easy: DiffStats;
  medium: DiffStats;
  hard: DiffStats;
};

const EMPTY_DIFF: DiffStats = { gamesWon: 0, bestTimeMs: 0 };
const EMPTY_STATS: MinesweeperStats = {
  totalCoins: 0,
  easy: { ...EMPTY_DIFF },
  medium: { ...EMPTY_DIFF },
  hard: { ...EMPTY_DIFF },
};

const STORAGE_KEY = "minero_minesweeper_stats_v1";

function parseDiff(v: unknown): DiffStats {
  if (!v || typeof v !== "object") return { ...EMPTY_DIFF };
  const o = v as Record<string, unknown>;
  return {
    gamesWon: Number(o.gamesWon) || 0,
    bestTimeMs: Number(o.bestTimeMs) || 0,
  };
}

function parseStats(raw: string | null): MinesweeperStats {
  if (!raw) return EMPTY_STATS;
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      easy: parseDiff(p.easy),
      medium: parseDiff(p.medium),
      hard: parseDiff(p.hard),
    };
  } catch {
    return EMPTY_STATS;
  }
}

let cachedRaw: string | null = null;
let cachedStats: MinesweeperStats = EMPTY_STATS;

function getSnapshot(): MinesweeperStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = parseStats(raw);
  }
  return cachedStats;
}

function getServerSnapshot(): MinesweeperStats {
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

function writeStats(next: MinesweeperStats) {
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
   Board model
   ============================================================ */

type Cell = {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
  exploded: boolean;
};

type Status = "idle" | "playing" | "won" | "lost";

function emptyBoard(spec: DifficultySpec): Cell[] {
  return Array.from({ length: spec.cols * spec.rows }, () => ({
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
    exploded: false,
  }));
}

function neighborIndexes(
  i: number,
  cols: number,
  rows: number,
): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

// Place mines avoiding the first-click cell and its neighborhood so the first
// click always reveals a non-trivial area.
function placeMines(
  base: Cell[],
  spec: DifficultySpec,
  safeIndex: number,
): Cell[] {
  const { cols, rows, mines } = spec;
  const total = cols * rows;
  const forbidden = new Set<number>([
    safeIndex,
    ...neighborIndexes(safeIndex, cols, rows),
  ]);

  // Reservoir-style candidate list, then shuffle.
  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mineIndexes = new Set<number>(candidates.slice(0, mines));

  const next = base.map((c) => ({ ...c }));
  mineIndexes.forEach((idx) => {
    next[idx].mine = true;
  });
  for (let i = 0; i < total; i++) {
    if (next[i].mine) continue;
    const n = neighborIndexes(i, cols, rows);
    next[i].adjacent = n.reduce((acc, ni) => acc + (next[ni].mine ? 1 : 0), 0);
  }
  return next;
}

// Iterative flood-fill reveal starting from `start`. Returns a new board.
function floodReveal(
  board: Cell[],
  start: number,
  cols: number,
  rows: number,
): Cell[] {
  const next = board.map((c) => ({ ...c }));
  const queue: number[] = [start];
  const seen = new Set<number>();
  while (queue.length) {
    const i = queue.shift() as number;
    if (seen.has(i)) continue;
    seen.add(i);
    const cell = next[i];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) {
      for (const ni of neighborIndexes(i, cols, rows)) {
        if (!seen.has(ni) && !next[ni].revealed && !next[ni].mine) {
          queue.push(ni);
        }
      }
    }
  }
  return next;
}

function revealAllMines(board: Cell[], explodedIdx: number): Cell[] {
  return board.map((c, i) => {
    if (!c.mine) return c;
    return { ...c, revealed: true, exploded: i === explodedIdx };
  });
}

function hasWon(board: Cell[]): boolean {
  for (const c of board) {
    if (!c.mine && !c.revealed) return false;
  }
  return true;
}

function computeScore(spec: DifficultySpec, elapsedMs: number) {
  const timePenalty = Math.floor(elapsedMs / 1000) * SCORE_TIME_PENALTY;
  return Math.max(0, Math.round(SCORE_BASE * spec.multiplier - timePenalty));
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const NUMBER_COLOR: Record<number, string> = {
  1: "#60a5fa",
  2: "#4ade80",
  3: "#ff6369",
  4: "#c084fc",
  5: "#f59e0b",
  6: "#22d3ee",
  7: "#f472b6",
  8: "#a0a0a8",
};

/* ============================================================
   Main client
   ============================================================ */

export default function MinesweeperClient({
  playerName,
}: {
  playerName: string;
}) {
  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const spec = DIFFICULTIES[difficulty];

  const [board, setBoard] = useState<Cell[]>(() => emptyBoard(spec));
  const [status, setStatus] = useState<Status>("idle");
  const [flagMode, setFlagMode] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [finalScore, setFinalScore] = useState<number>(0);
  const [finalElapsedMs, setFinalElapsedMs] = useState<number>(0);

  const resetBoard = useCallback((target: Difficulty) => {
    const nextSpec = DIFFICULTIES[target];
    setDifficulty(target);
    setBoard(emptyBoard(nextSpec));
    setStatus("idle");
    setStartedAt(null);
    setFinalScore(0);
    setFinalElapsedMs(0);
    setFlagMode(false);
  }, []);

  // Live timer while playing
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [status]);

  const mineCount = spec.mines;
  const flagCount = board.reduce((n, c) => n + (c.flagged ? 1 : 0), 0);
  const minesRemaining = Math.max(0, mineCount - flagCount);

  const elapsedMs =
    status === "won" || status === "lost"
      ? finalElapsedMs
      : startedAt
        ? now - startedAt
        : 0;

  const finishWin = useCallback(
    (doneBoard: Cell[], startMs: number) => {
      const elapsed = Date.now() - startMs;
      const score = computeScore(spec, elapsed);
      // Auto-flag unflagged mines on win for visual completeness.
      const finalized = doneBoard.map((c) => {
        if (c.mine && !c.flagged) return { ...c, flagged: true };
        return c;
      });
      setBoard(finalized);
      setFinalScore(score);
      setFinalElapsedMs(elapsed);
      setStatus("won");

      const prev = getSnapshot();
      const prevDiff = prev[difficulty];
      const nextDiff: DiffStats = {
        gamesWon: prevDiff.gamesWon + 1,
        bestTimeMs:
          prevDiff.bestTimeMs === 0
            ? elapsed
            : Math.min(prevDiff.bestTimeMs, elapsed),
      };
      writeStats({
        ...prev,
        totalCoins: prev.totalCoins + score,
        [difficulty]: nextDiff,
      });
    },
    [difficulty, spec],
  );

  const finishLoss = useCallback((doneBoard: Cell[], startMs: number) => {
    setBoard(doneBoard);
    setFinalElapsedMs(Date.now() - startMs);
    setFinalScore(0);
    setStatus("lost");
  }, []);

  const handleReveal = useCallback(
    (index: number) => {
      if (status === "won" || status === "lost") return;
      const cell = board[index];
      if (cell.flagged || cell.revealed) return;

      // First reveal seeds the mines and starts the timer.
      let boardNow = board;
      let startMs = startedAt ?? Date.now();
      if (status === "idle") {
        boardNow = placeMines(board, spec, index);
        startMs = Date.now();
        setStartedAt(startMs);
        setNow(startMs);
        setStatus("playing");
      }

      const target = boardNow[index];
      if (target.mine) {
        const next = revealAllMines(boardNow, index);
        finishLoss(next, startMs);
        return;
      }

      const next =
        target.adjacent === 0
          ? floodReveal(boardNow, index, spec.cols, spec.rows)
          : boardNow.map((c, i) =>
              i === index ? { ...c, revealed: true } : c,
            );

      if (hasWon(next)) {
        finishWin(next, startMs);
      } else {
        setBoard(next);
      }
    },
    [board, finishLoss, finishWin, spec, startedAt, status],
  );

  const handleToggleFlag = useCallback(
    (index: number) => {
      if (status === "won" || status === "lost") return;
      const cell = board[index];
      if (cell.revealed) return;
      setBoard((prev) =>
        prev.map((c, i) => (i === index ? { ...c, flagged: !c.flagged } : c)),
      );
      if (status === "idle") {
        // Let the player flag before the first reveal without starting the timer.
      }
    },
    [board, status],
  );

  const onCellClick = useCallback(
    (index: number) => {
      if (flagMode) {
        handleToggleFlag(index);
      } else {
        handleReveal(index);
      }
    },
    [flagMode, handleReveal, handleToggleFlag],
  );

  const firstName = playerName?.split(/\s+/)[0] || "Miner";
  const currentDiffStats = stats[difficulty];

  const gridTemplate = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(${spec.cols}, minmax(0, 1fr))`,
      gridAutoRows: "1fr",
      gap: "2px",
    }),
    [spec.cols],
  );

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-5 lg:mb-7">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Minesweeper
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Clear every non-mine cell. Numbers show how many mines touch a cell.
          First click is always safe.
        </p>
      </header>

      {/* Difficulty switcher + flag-mode toggle */}
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
                {s.cols}×{s.rows} · {s.mines}
              </span>
            </button>
          );
        })}

        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFlagMode((m) => !m)}
            aria-pressed={flagMode}
            className="btn btn-sm"
            style={{
              background: flagMode ? "var(--brand-weak)" : "var(--surface-2)",
              color: flagMode ? "var(--brand-weak-fg)" : "var(--text)",
              borderColor: flagMode
                ? "color-mix(in oklab, var(--brand) 40%, transparent)"
                : "var(--border)",
            }}
            title="Toggle flag mode — also available via right-click / long-press"
          >
            <IconFlag size={14} />
            {flagMode ? "Flag mode" : "Reveal mode"}
          </button>
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Mines remaining</span>
          <span
            className="kpi-value flex items-center gap-1.5"
            style={{ fontSize: "var(--fs-20)" }}
          >
            <IconMine size={16} />
            {minesRemaining}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Time</span>
          <span
            className="kpi-value flex items-center gap-1.5"
            style={{
              fontSize: "var(--fs-20)",
              fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
            }}
          >
            <IconClock size={14} />
            {formatTime(elapsedMs)}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Wins ({spec.label})</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {currentDiffStats.gamesWon}
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

      {/* Result banners */}
      {status === "won" && (
        <ResultBanner
          kind="won"
          title={`Swept clean, ${firstName}!`}
          detail={<>Cleared in {formatTime(finalElapsedMs)} · <IconCoin size={13} style={{ display: "inline", verticalAlign: "middle" }} /> +{finalScore} coins</>}
          actionLabel="Play again"
          onAction={() => resetBoard(difficulty)}
        />
      )}
      {status === "lost" && (
        <ResultBanner
          kind="lost"
          title="Boom — hit a mine"
          detail={`Board revealed. Flip a new one to try again.`}
          actionLabel="New board"
          onAction={() => resetBoard(difficulty)}
        />
      )}

      {/* Board */}
      <div
        className="surface p-2 lg:p-3"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        <div
          style={gridTemplate}
          role="grid"
          aria-rowcount={spec.rows}
          aria-colcount={spec.cols}
          aria-label="Minesweeper board"
        >
          {board.map((cell, i) => (
            <CellButton
              key={i}
              cell={cell}
              index={i}
              disabled={status === "won" || status === "lost"}
              onPrimary={onCellClick}
              onFlag={handleToggleFlag}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-5 flex items-center justify-between text-xs"
        style={{ color: "var(--text-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <IconSparkles size={14} />
          Score = {SCORE_BASE} × multiplier − seconds × {SCORE_TIME_PENALTY}
        </div>
        <button
          type="button"
          onClick={() => resetBoard(difficulty)}
          className="btn btn-ghost btn-sm"
        >
          New board
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Cell
   ============================================================ */

function CellButton({
  cell,
  index,
  disabled,
  onPrimary,
  onFlag,
}: {
  cell: Cell;
  index: number;
  disabled: boolean;
  onPrimary: (i: number) => void;
  onFlag: (i: number) => void;
}) {
  const { revealed, mine, adjacent, flagged, exploded } = cell;

  const background = exploded
    ? "var(--danger-weak)"
    : revealed
      ? "var(--surface-3)"
      : "var(--surface-2)";
  const borderColor = exploded
    ? "color-mix(in oklab, var(--danger) 45%, transparent)"
    : revealed
      ? "var(--border)"
      : "var(--border-strong)";

  const numberColor =
    revealed && !mine && adjacent > 0
      ? (NUMBER_COLOR[adjacent] ?? "var(--text)")
      : "var(--text)";

  let content: React.ReactNode = null;
  if (revealed) {
    if (mine) {
      content = (
        <IconMine
          size={14}
          style={{ color: exploded ? "var(--danger-fg)" : "var(--text-muted)" }}
        />
      );
    } else if (adjacent > 0) {
      content = (
        <span
          className="font-mono font-bold"
          style={{ color: numberColor, fontSize: "var(--fs-14)" }}
        >
          {adjacent}
        </span>
      );
    }
  } else if (flagged) {
    content = (
      <IconFlag size={14} style={{ color: "var(--brand)" }} />
    );
  }

  return (
    <button
      type="button"
      role="gridcell"
      aria-disabled={disabled}
      aria-label={
        revealed
          ? mine
            ? "Mine"
            : adjacent > 0
              ? `${adjacent} adjacent mines`
              : "Empty"
          : flagged
            ? "Flagged cell"
            : "Hidden cell"
      }
      disabled={disabled && !flagged && !revealed}
      onClick={() => onPrimary(index)}
      onContextMenu={(e) => {
        e.preventDefault();
        onFlag(index);
      }}
      style={{
        aspectRatio: "1 / 1",
        width: "100%",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "default" : "pointer",
        transition:
          "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {content}
    </button>
  );
}

/* ============================================================
   Result banner
   ============================================================ */

function ResultBanner({
  kind,
  title,
  detail,
  actionLabel,
  onAction,
}: {
  kind: "won" | "lost";
  title: string;
  detail: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
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
      </div>
      <button onClick={onAction} className="btn btn-primary">
        {actionLabel}
        <IconArrowRight size={16} />
      </button>
    </section>
  );
}
