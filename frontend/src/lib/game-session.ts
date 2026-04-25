// Client helpers for the server-authoritative game-coin system.
// Games call startGameSession() before play and finishGameSession() when
// the play ends; the server computes coinsEarned and updates the user's
// gameCoinsBalance. The Rewards page redeems from that balance.

import { API_URL } from "./api-url";

export const VALID_GAME_KEYS = [
  "trivia",
  "spin",
  "memory",
  "minesweeper",
  "word",
  "snake",
  "blockblast",
] as const;

export type GameKey = (typeof VALID_GAME_KEYS)[number];

export type StartSessionResult =
  | { ok: true; sessionId: string; startedAt: string }
  | { ok: false; error: string; retryAfterMs?: number; status: number };

export type FinishSessionResult =
  | { ok: true; sessionId: string; coinsEarned: number; balance: number; capped: boolean }
  | { ok: false; error: string; status: number };

export type BalanceResult = {
  balance: number;
  today: Record<string, number>;
  caps: Record<string, { dailyCoinCap: number; cooldownMs: number; maxCoinsPerSession: number }>;
};

export async function startGameSession(gameKey: GameKey): Promise<StartSessionResult> {
  try {
    const res = await fetch(`${API_URL}/game/session/start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameKey }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      sessionId?: string;
      startedAt?: string;
      error?: string;
      retryAfterMs?: number;
    };
    if (!res.ok || !data.sessionId) {
      return {
        ok: false,
        error: data.error ?? "Failed to start session",
        retryAfterMs: data.retryAfterMs,
        status: res.status,
      };
    }
    return { ok: true, sessionId: data.sessionId, startedAt: data.startedAt ?? "" };
  } catch {
    return { ok: false, error: "Network error", status: 0 };
  }
}

// In-flight finish-session payloads. If the user navigates while a finish
// fetch is pending, the browser cancels the fetch — but `pagehide` fires
// first, and we replay each pending payload via sendBeacon so the server
// still credits the coins. The duplicate finish (if both arrive) is safe:
// the backend returns 409 "Session already finished" on the second one.
const pendingFinishes = new Map<number, string>();
let nextFinishId = 0;

if (typeof window !== "undefined") {
  const flush = () => {
    if (pendingFinishes.size === 0) return;
    for (const body of pendingFinishes.values()) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(`${API_URL}/game/session/finish`, blob);
      } catch {
        /* best-effort */
      }
    }
    pendingFinishes.clear();
  };
  // `pagehide` is the reliable signal across browsers (works for bfcache too).
  window.addEventListener("pagehide", flush);
  // Belt-and-suspenders for older Safari that may not fire pagehide on every nav.
  window.addEventListener("beforeunload", flush);
}

export async function finishGameSession(
  sessionId: string,
  score: number,
  meta?: Record<string, unknown>,
): Promise<FinishSessionResult> {
  const body = JSON.stringify({ sessionId, score, meta });
  const finishId = nextFinishId++;
  pendingFinishes.set(finishId, body);
  try {
    const res = await fetch(`${API_URL}/game/session/finish`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
    pendingFinishes.delete(finishId);
    const data = (await res.json().catch(() => ({}))) as {
      sessionId?: string;
      coinsEarned?: number;
      balance?: number;
      capped?: boolean;
      error?: string;
    };
    if (!res.ok || typeof data.coinsEarned !== "number") {
      return { ok: false, error: data.error ?? "Failed to finish session", status: res.status };
    }
    return {
      ok: true,
      sessionId: data.sessionId ?? sessionId,
      coinsEarned: data.coinsEarned,
      balance: data.balance ?? 0,
      capped: Boolean(data.capped),
    };
  } catch {
    pendingFinishes.delete(finishId);
    return { ok: false, error: "Network error", status: 0 };
  }
}

export async function getGameBalance(): Promise<BalanceResult | null> {
  try {
    const res = await fetch(`${API_URL}/game/balance`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as BalanceResult;
  } catch {
    return null;
  }
}

/** Fired when the server balance should be re-fetched (after a finish/redeem). */
export const GAME_BALANCE_CHANGED = "minero:game-balance-change";

export function emitBalanceChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(GAME_BALANCE_CHANGED));
  }
}

// One-time legacy migration: users who played games before the
// server-authoritative session flow shipped have lifetime totals only in
// localStorage. importLegacyCoinsOnce() reads those totals (capped on the
// server) and credits the user's gameCoinsBalance. Idempotent on both
// sides — guarded by a localStorage flag and User.legacyImported on the
// backend.

const LEGACY_IMPORTED_KEY = "minero_legacy_imported_v1";

const LEGACY_GAME_STORAGE_KEYS: Record<GameKey, string> = {
  trivia: "minero_trivia_stats_v1",
  spin: "minero_spin_stats_v1",
  memory: "minero_memory_stats_v1",
  minesweeper: "minero_minesweeper_stats_v1",
  word: "minero_word_stats_v1",
  snake: "minero_snake_stats_v1",
  blockblast: "minero_blockblast_stats_v1",
};

function readLegacyTotal(storageKey: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { totalCoins?: unknown; totalPoints?: unknown };
    const coins = Number(parsed?.totalCoins);
    if (Number.isFinite(coins) && coins > 0) return coins;
    const pts = Number(parsed?.totalPoints);
    return Number.isFinite(pts) && pts > 0 ? pts : 0;
  } catch {
    return 0;
  }
}

export type LegacyImportResult =
  | { ok: true; credited: number; balance: number; alreadyImported: boolean }
  | { ok: false; error: string };

export async function importLegacyCoinsOnce(): Promise<LegacyImportResult | null> {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(LEGACY_IMPORTED_KEY) === "1") return null;

  const totals = {} as Record<GameKey, number>;
  let any = 0;
  for (const key of VALID_GAME_KEYS) {
    const t = readLegacyTotal(LEGACY_GAME_STORAGE_KEYS[key]);
    totals[key] = t;
    any += t;
  }
  if (any <= 0) {
    // Nothing to import — mark done so we never retry on this device.
    window.localStorage.setItem(LEGACY_IMPORTED_KEY, "1");
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/game/import-legacy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totals }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      credited?: number;
      balance?: number;
      alreadyImported?: boolean;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "Import failed" };
    }
    // Mark imported on this device so we don't retry. Server-side
    // legacyImported flag is the canonical guard.
    window.localStorage.setItem(LEGACY_IMPORTED_KEY, "1");
    if (data.credited && data.credited > 0) emitBalanceChange();
    return {
      ok: true,
      credited: data.credited ?? 0,
      balance: data.balance ?? 0,
      alreadyImported: Boolean(data.alreadyImported),
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
