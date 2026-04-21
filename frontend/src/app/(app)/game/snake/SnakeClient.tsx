"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { IconArrowRight, IconError, IconTrophy } from "@/components/icons";

/* ============================================================
   Config
   ============================================================ */

const GRID = 20; // 20×20 playfield
const BASE_STEP_MS = 160; // starting tick interval
const MIN_STEP_MS = 60; // fastest tick interval
const SPEEDUP_PER_APPLE_MS = 4; // shave this much off each tick per apple eaten
const POINTS_PER_APPLE = 10;

type Point = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Status = "idle" | "playing" | "paused" | "over";

const DIR_VEC: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/* ============================================================
   Persisted stats
   ============================================================ */

type Stats = {
  totalPoints: number;
  bestScore: number;
  gamesPlayed: number;
  applesEaten: number;
};

const EMPTY_STATS: Stats = {
  totalPoints: 0,
  bestScore: 0,
  gamesPlayed: 0,
  applesEaten: 0,
};

const STORAGE_KEY = "minero_snake_stats_v1";

function parseStats(raw: string | null): Stats {
  if (!raw) return EMPTY_STATS;
  try {
    const p = JSON.parse(raw) as Partial<Stats>;
    return {
      totalPoints: Number(p.totalPoints) || 0,
      bestScore: Number(p.bestScore) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      applesEaten: Number(p.applesEaten) || 0,
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
  } catch {
    /* quota / private mode */
  }
}

/* ============================================================
   Game helpers
   ============================================================ */

function spawnApple(snake: Point[]): Point {
  // Reservoir pick from free cells so apples never land on the snake.
  const occupied = new Set(snake.map((p) => p.y * GRID + p.x));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(y * GRID + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

function initialSnake(): Point[] {
  const midY = Math.floor(GRID / 2);
  return [
    { x: 6, y: midY },
    { x: 5, y: midY },
    { x: 4, y: midY },
  ];
}

/* ============================================================
   Main client
   ============================================================ */

export default function SnakeClient({ playerName }: { playerName: string }) {
  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  // Live game state kept in refs so the tick loop can read/mutate without
  // forcing the whole client to re-render each step.
  const snakeRef = useRef<Point[]>(initialSnake());
  const appleRef = useRef<Point>(spawnApple(snakeRef.current));
  const dirRef = useRef<Dir>("right");
  // Queue next direction so a rapid two-input sequence (e.g. up then right
  // inside one tick) still applies both.
  const nextDirRef = useRef<Dir>("right");
  const applesEatenRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tickTimerRef = useRef<number | null>(null);

  /* -------- Rendering -------- */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const cell = width / GRID;

    // Background
    ctx.fillStyle = "#1b1b1f";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(width, i * cell);
      ctx.stroke();
    }

    // Apple
    const apple = appleRef.current;
    const pad = Math.max(2, cell * 0.14);
    ctx.fillStyle = "#ff6369";
    roundRect(
      ctx,
      apple.x * cell + pad,
      apple.y * cell + pad,
      cell - pad * 2,
      cell - pad * 2,
      Math.max(2, cell * 0.2),
    );
    ctx.fill();

    // Snake
    const snake = snakeRef.current;
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i];
      const isHead = i === 0;
      ctx.fillStyle = isHead ? "#f0b429" : "#d99a0b";
      const sp = Math.max(1, cell * 0.08);
      roundRect(
        ctx,
        seg.x * cell + sp,
        seg.y * cell + sp,
        cell - sp * 2,
        cell - sp * 2,
        Math.max(2, cell * 0.22),
      );
      ctx.fill();

      // Eye pips on the head so the snake has a face.
      if (isHead) {
        const d = dirRef.current;
        const eyeSize = Math.max(2, cell * 0.1);
        const cx = seg.x * cell + cell / 2;
        const cy = seg.y * cell + cell / 2;
        const off = cell * 0.22;
        const ex1 = { x: cx, y: cy };
        const ex2 = { x: cx, y: cy };
        if (d === "up") {
          ex1.x -= off;
          ex1.y -= off;
          ex2.x += off;
          ex2.y -= off;
        } else if (d === "down") {
          ex1.x -= off;
          ex1.y += off;
          ex2.x += off;
          ex2.y += off;
        } else if (d === "left") {
          ex1.x -= off;
          ex1.y -= off;
          ex2.x -= off;
          ex2.y += off;
        } else {
          ex1.x += off;
          ex1.y -= off;
          ex2.x += off;
          ex2.y += off;
        }
        ctx.fillStyle = "#18120a";
        ctx.beginPath();
        ctx.arc(ex1.x, ex1.y, eyeSize, 0, Math.PI * 2);
        ctx.arc(ex2.x, ex2.y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  /* -------- Resize handling -------- */

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // Width is whatever the container affords; height matches for a square
    // board (with a GRID-aligned rounded size to avoid seams).
    const size = Math.floor(container.clientWidth);
    const cell = Math.floor(size / GRID);
    const pixelSize = cell * GRID;
    canvas.style.width = pixelSize + "px";
    canvas.style.height = pixelSize + "px";
    canvas.width = pixelSize * dpr;
    canvas.height = pixelSize * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }, [draw]);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resizeCanvas]);

  /* -------- Tick loop -------- */

  const stepMs = useCallback(() => {
    return Math.max(
      MIN_STEP_MS,
      BASE_STEP_MS - applesEatenRef.current * SPEEDUP_PER_APPLE_MS,
    );
  }, []);

  const finishGame = useCallback(() => {
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    const runScore = applesEatenRef.current * POINTS_PER_APPLE;
    setFinalScore(runScore);
    setStatus("over");

    const prev = getSnapshot();
    writeStats({
      totalPoints: prev.totalPoints + runScore,
      bestScore: Math.max(prev.bestScore, runScore),
      gamesPlayed: prev.gamesPlayed + 1,
      applesEaten: prev.applesEaten + applesEatenRef.current,
    });
  }, []);

  const tick = useCallback(() => {
    // Apply queued direction, guarding against 180° flips.
    const desired = nextDirRef.current;
    if (desired !== OPPOSITE[dirRef.current]) {
      dirRef.current = desired;
    }
    const snake = snakeRef.current;
    const head = snake[0];
    const v = DIR_VEC[dirRef.current];
    const nextHead = { x: head.x + v.x, y: head.y + v.y };

    // Wall collision
    if (
      nextHead.x < 0 ||
      nextHead.x >= GRID ||
      nextHead.y < 0 ||
      nextHead.y >= GRID
    ) {
      finishGame();
      return;
    }
    // Self collision (tail about to move is still in snake, so check all
    // segments except the current last — which will vacate unless we're about
    // to grow).
    const willEatApple =
      nextHead.x === appleRef.current.x && nextHead.y === appleRef.current.y;
    const check = willEatApple ? snake : snake.slice(0, -1);
    for (const seg of check) {
      if (seg.x === nextHead.x && seg.y === nextHead.y) {
        finishGame();
        return;
      }
    }

    const newSnake = [nextHead, ...(willEatApple ? snake : snake.slice(0, -1))];
    snakeRef.current = newSnake;

    if (willEatApple) {
      applesEatenRef.current += 1;
      setScore(applesEatenRef.current * POINTS_PER_APPLE);
      appleRef.current = spawnApple(newSnake);
      // Restart timer so the new (faster) step rate takes effect.
      if (tickTimerRef.current !== null) {
        window.clearInterval(tickTimerRef.current);
        tickTimerRef.current = window.setInterval(tick, stepMs());
      }
    }
    draw();
  }, [draw, finishGame, stepMs]);

  const startRun = useCallback(() => {
    snakeRef.current = initialSnake();
    appleRef.current = spawnApple(snakeRef.current);
    dirRef.current = "right";
    nextDirRef.current = "right";
    applesEatenRef.current = 0;
    setScore(0);
    setFinalScore(0);
    setStatus("playing");
    draw();
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
    }
    tickTimerRef.current = window.setInterval(tick, stepMs());
  }, [draw, stepMs, tick]);

  const pauseRun = useCallback(() => {
    if (status !== "playing") return;
    if (tickTimerRef.current !== null) {
      window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    setStatus("paused");
  }, [status]);

  const resumeRun = useCallback(() => {
    if (status !== "paused") return;
    setStatus("playing");
    tickTimerRef.current = window.setInterval(tick, stepMs());
  }, [status, stepMs, tick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tickTimerRef.current !== null) {
        window.clearInterval(tickTimerRef.current);
      }
    };
  }, []);

  /* -------- Input: keyboard -------- */

  const queueDir = useCallback((d: Dir) => {
    if (d === OPPOSITE[dirRef.current]) return;
    nextDirRef.current = d;
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") {
        e.preventDefault();
        queueDir("up");
      } else if (k === "arrowdown" || k === "s") {
        e.preventDefault();
        queueDir("down");
      } else if (k === "arrowleft" || k === "a") {
        e.preventDefault();
        queueDir("left");
      } else if (k === "arrowright" || k === "d") {
        e.preventDefault();
        queueDir("right");
      } else if (k === " ") {
        e.preventDefault();
        if (status === "playing") pauseRun();
        else if (status === "paused") resumeRun();
      } else if (k === "r") {
        e.preventDefault();
        startRun();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pauseRun, queueDir, resumeRun, startRun, status]);

  /* -------- Input: swipe -------- */

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    function onEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const THRESHOLD = 24;
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        queueDir(dx > 0 ? "right" : "left");
      } else {
        queueDir(dy > 0 ? "down" : "up");
      }
    }
    function onMove(e: TouchEvent) {
      if (tracking) e.preventDefault();
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [queueDir]);

  const firstName = playerName?.split(/\s+/)[0] || "Miner";

  return (
    <div className="mx-auto max-w-[620px] px-4 py-6 lg:py-8">
      <header className="mb-5 lg:mb-6">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Snake
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Arcade classic. Eat apples, grow, don&apos;t hit yourself.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Score</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {score}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Best</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {stats.bestScore}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Games played</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {stats.gamesPlayed}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Apples (total)</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {stats.applesEaten}
          </span>
        </div>
      </div>

      {/* Banners */}
      {status === "over" && (
        <ResultBanner
          title={
            finalScore > 0 && finalScore >= stats.bestScore
              ? `New best, ${firstName}!`
              : "Game over"
          }
          detail={`${finalScore} points this run · Best ${Math.max(stats.bestScore, finalScore)}`}
          onAction={startRun}
          actionLabel="Play again"
        />
      )}

      {/* Board */}
      <div
        ref={containerRef}
        className="surface mx-auto relative"
        style={{
          padding: 4,
          borderRadius: "var(--radius-lg)",
          aspectRatio: "1 / 1",
          maxWidth: 520,
          touchAction: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Snake playing field"
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            borderRadius: "var(--radius-md)",
          }}
        />
        {(status === "idle" || status === "paused") && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{
              background: "color-mix(in oklab, var(--bg) 80%, transparent)",
              backdropFilter: "blur(2px)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {status === "paused" ? "Paused" : "Ready to play"}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={status === "paused" ? resumeRun : startRun}
            >
              {status === "paused" ? "Resume" : "Start run"}
              <IconArrowRight size={16} />
            </button>
            {status === "idle" && (
              <div
                className="text-xs"
                style={{ color: "var(--text-subtle)" }}
              >
                Arrows / WASD · Swipe on mobile · Space to pause
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile d-pad + controls */}
      <div className="mt-5 grid grid-cols-3 gap-2 max-w-[240px] mx-auto sm:hidden">
        <div />
        <DPadButton
          label="Up"
          onClick={() => queueDir("up")}
          disabled={status !== "playing"}
          symbol="▲"
        />
        <div />
        <DPadButton
          label="Left"
          onClick={() => queueDir("left")}
          disabled={status !== "playing"}
          symbol="◀"
        />
        <div />
        <DPadButton
          label="Right"
          onClick={() => queueDir("right")}
          disabled={status !== "playing"}
          symbol="▶"
        />
        <div />
        <DPadButton
          label="Down"
          onClick={() => queueDir("down")}
          disabled={status !== "playing"}
          symbol="▼"
        />
        <div />
      </div>

      {/* Run controls */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={status === "playing" ? pauseRun : resumeRun}
          disabled={status !== "playing" && status !== "paused"}
        >
          {status === "paused" ? "Resume" : "Pause"}
        </button>
        <div
          className="text-xs"
          style={{ color: "var(--text-subtle)" }}
        >
          +{POINTS_PER_APPLE} per apple · speeds up as you grow
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={startRun}
        >
          New run
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/* ============================================================
   Sub-components
   ============================================================ */

function DPadButton({
  label,
  symbol,
  onClick,
  disabled,
}: {
  label: string;
  symbol: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 56,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-2)",
        color: "var(--text)",
        fontSize: "1.2rem",
        cursor: "pointer",
        opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: "transparent",
        transition: "background var(--dur-fast) var(--ease-out)",
      }}
    >
      {symbol}
    </button>
  );
}

function ResultBanner({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section
      className="card mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--danger-weak) 75%, transparent), var(--surface))",
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0"
        style={{
          background: "var(--danger-weak)",
          color: "var(--danger-fg)",
        }}
      >
        <IconError size={22} />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-lg inline-flex items-center gap-2">
          <IconTrophy size={18} style={{ color: "var(--brand)" }} />
          {title}
        </h2>
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

