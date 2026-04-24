// Client helpers for the server-authoritative game-coin system.
// Games call startGameSession() before play and finishGameSession() when
// the play ends; the server computes coinsEarned and updates the user's
// gameCoinsBalance. The Rewards page redeems from that balance.

import { API_URL } from "./api-url";

export type GameKey =
  | "trivia"
  | "spin"
  | "memory"
  | "minesweeper"
  | "word"
  | "snake"
  | "blockblast";

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

export async function finishGameSession(
  sessionId: string,
  score: number,
  meta?: Record<string, unknown>,
): Promise<FinishSessionResult> {
  try {
    const res = await fetch(`${API_URL}/game/session/finish`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, score, meta }),
    });
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
