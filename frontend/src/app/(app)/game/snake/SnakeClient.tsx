"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowRight, IconClock, IconCoin, IconError, IconTrophy } from "@/components/icons";
import {
  startGameSession,
  finishGameSession,
  emitBalanceChange,
} from "@/lib/game-session";

/* ============================================================
   Config
   ============================================================ */

// Score sent to the server scales with time played (seconds ÷ 3).
// Server-side daily cap prevents abuse; honest time is good enough.
const SCORE_PER_SECOND = 1 / 3;

const EMBED_URL = "https://idev.games/embed/snake-game";

type Status = "idle" | "playing" | "done";

/* ============================================================
   Persisted stats (local — no server call needed for these)
   ============================================================ */

type Stats = { bestTime: number; gamesPlayed: number };
const EMPTY_STATS: Stats = { bestTime: 0, gamesPlayed: 0 };
const STORAGE_KEY = "minero_snake_stats_v2";

function readStats(): Stats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const p = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Stats>;
    return { bestTime: Number(p.bestTime) || 0, gamesPlayed: Number(p.gamesPlayed) || 0 };
  } catch { return EMPTY_STATS; }
}

function saveStats(s: Stats) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota */ }
}

/* ============================================================
   Main client
   ============================================================ */

export default function SnakeClient({ playerName }: { playerName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);           // seconds this run
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  // Server result after finishing
  const [submitting, setSubmitting] = useState(false);
  const [serverCoins, setServerCoins] = useState<number | null>(null);
  const [serverCapped, setServerCapped] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [retryAfterMs, setRetryAfterMs] = useState(0);

  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // Load stats on mount
  useEffect(() => { setStats(readStats()); }, []);

  // Countdown to retry when session blocked
  useEffect(() => {
    if (!sessionError || retryAfterMs <= 0) return;
    const deadline = Date.now() + retryAfterMs;
    const id = window.setInterval(() => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        setRetryAfterMs(0);
        setSessionError(null);
        clearInterval(id);
      } else {
        setRetryAfterMs(remaining);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sessionError, retryAfterMs]);

  const startRun = useCallback(async () => {
    setSessionError(null);
    setServerCoins(null);
    setServerCapped(false);
    setElapsed(0);

    const res = await startGameSession("snake");
    if (!res.ok) {
      if (res.retryAfterMs) {
        setSessionError(res.error);
        setRetryAfterMs(res.retryAfterMs);
        return;
      }
      // Network error: let them play, just won't earn coins.
      sessionIdRef.current = null;
    } else {
      sessionIdRef.current = res.sessionId;
    }

    startTimeRef.current = Date.now();
    setStatus("playing");

    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const endRun = useCallback(async () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const seconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsed(seconds);
    setStatus("done");
    setSubmitting(true);

    // Update local stats
    setStats((prev) => {
      const next = {
        bestTime: Math.max(prev.bestTime, seconds),
        gamesPlayed: prev.gamesPlayed + 1,
      };
      saveStats(next);
      return next;
    });

    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sid) {
      const score = Math.round(seconds * SCORE_PER_SECOND);
      const r = await finishGameSession(sid, score);
      setSubmitting(false);
      if (r.ok) {
        setServerCoins(r.coinsEarned);
        setServerCapped(r.capped);
        emitBalanceChange();
      }
    } else {
      setSubmitting(false);
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current !== null) clearInterval(timerRef.current); }, []);

  const firstName = playerName?.split(/\s+/)[0] || "Miner";

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 lg:py-8">
      <header className="mb-5 lg:mb-6">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Snake</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Eat apples, grow, don&apos;t hit yourself. Earn coins for time played.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">This run</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {formatTime(elapsed)}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Best time</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {formatTime(stats.bestTime)}
          </span>
        </div>
        <div className="kpi" style={{ padding: "0.85rem" }}>
          <span className="kpi-label">Games played</span>
          <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
            {stats.gamesPlayed}
          </span>
        </div>
      </div>

      {/* Cooldown / session error */}
      {sessionError && retryAfterMs > 0 && (
        <div className="alert alert-warning mb-5">
          <span>
            Daily limit reached. Come back in{" "}
            <strong>{formatTime(Math.ceil(retryAfterMs / 1000))}</strong>.
          </span>
        </div>
      )}

      {/* Game-over result */}
      {status === "done" && (
        <div
          className="card mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--brand-weak) 80%, transparent), var(--surface))",
          }}
        >
          <span
            aria-hidden
            className="inline-flex h-12 w-12 items-center justify-center rounded-full shrink-0"
            style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
          >
            <IconTrophy size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg">
              {serverCoins && serverCoins > 0 ? `Nice run, ${firstName}!` : "Run finished"}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {submitting ? (
                "Confirming coins with server…"
              ) : serverCoins !== null ? (
                <>
                  <IconCoin size={13} style={{ display: "inline", verticalAlign: "middle", color: "var(--brand)" }} />{" "}
                  <strong>+{serverCoins} coins</strong> earned ·{" "}
                  {formatTime(elapsed)} played
                  {serverCapped && " · daily cap reached"}
                </>
              ) : (
                <>
                  <IconClock size={13} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
                  {formatTime(elapsed)} played · no session active
                </>
              )}
            </p>
          </div>
          <button onClick={startRun} className="btn btn-primary">
            Play again
            <IconArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Iframe game embed */}
      <div
        className="surface"
        style={{
          padding: 0,
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          aspectRatio: "4 / 3",
          position: "relative",
        }}
      >
        {status === "playing" ? (
          <iframe
            src={EMBED_URL}
            title="Snake game"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            sandbox="allow-scripts allow-same-origin"
            allow="fullscreen"
          />
        ) : (
          /* Overlay shown when not yet playing */
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: "var(--surface)" }}
          >
            <div style={{ fontSize: 48 }} aria-hidden>🐍</div>
            <p className="text-sm text-center px-6" style={{ color: "var(--text-muted)" }}>
              {status === "done"
                ? "Start a new game to play again."
                : "Hit Start to launch the game. Your session begins immediately."}
            </p>
            {status === "idle" && (
              <button onClick={startRun} className="btn btn-primary" disabled={!!(sessionError && retryAfterMs > 0)}>
                Start run
                <IconArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          <IconCoin size={12} style={{ display: "inline", verticalAlign: "middle" }} />{" "}
          Coins scale with time played · daily cap applies
        </div>
        {status === "playing" && (
          <button onClick={endRun} className="btn btn-secondary btn-sm" disabled={submitting}>
            {submitting ? "Saving…" : "Done playing"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
