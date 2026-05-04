import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { rateLimit } from "../lib/rateLimit.js";
import { getClientIp, getDeviceHash } from "../lib/request.js";
import {
  GAME_CONFIG,
  VALID_GAME_KEYS,
  isGameKey,
  scoreToCoins,
  type GameKey,
} from "../lib/games.js";

export const gameRoutes = new Hono();

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Server-authoritative game-coin balance + today's earnings by game. */
gameRoutes.get("/balance", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const [user, todayByGame] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { gameCoinsBalance: true },
    }),
    prisma.gameSession.groupBy({
      by: ["gameKey"],
      where: {
        userId: session.userId,
        finishedAt: { gte: startOfUtcDay() },
      },
      _sum: { coinsEarned: true },
    }),
  ]);

  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const today: Record<string, number> = {};
  for (const row of todayByGame) today[row.gameKey] = row._sum.coinsEarned ?? 0;

  return c.json({
    balance: user.gameCoinsBalance,
    today,
    caps: Object.fromEntries(
      VALID_GAME_KEYS.map((k) => [
        k,
        {
          dailyCoinCap: GAME_CONFIG[k].dailyCoinCap,
          cooldownMs: GAME_CONFIG[k].cooldownMs,
          maxCoinsPerSession: GAME_CONFIG[k].maxCoinsPerSession,
        },
      ]),
    ),
  });
});

/** Start a new game session. Returns a sessionId the client must submit on finish. */
gameRoutes.post("/session/start", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const body = (await c.req.json().catch(() => ({}))) as { gameKey?: unknown };
  if (!isGameKey(body.gameKey)) {
    return c.json({ error: "Invalid gameKey" }, 400);
  }
  const gameKey: GameKey = body.gameKey;
  const cfg = GAME_CONFIG[gameKey];

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { frozen: true },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  // Cooldown: refuse new session if a finished session of the same game is within cooldownMs.
  if (cfg.cooldownMs > 0) {
    const lastFinished = await prisma.gameSession.findFirst({
      where: {
        userId: session.userId,
        gameKey,
        finishedAt: { not: null },
      },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    });
    if (lastFinished?.finishedAt) {
      const remaining = lastFinished.finishedAt.getTime() + cfg.cooldownMs - Date.now();
      if (remaining > 0) {
        return c.json({ error: "Cooldown active", retryAfterMs: remaining }, 429);
      }
    }
  }

  // Rate limit checked last — only real session-creation attempts count.
  const rl = rateLimit(`game:start:${session.userId}:${gameKey}`, 20, 60_000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests", retryAfterMs: rl.retryAfterMs }, 429);
  }

  const created = await prisma.gameSession.create({
    data: {
      userId: session.userId,
      gameKey,
      ip: getClientIp(c),
      deviceHash: getDeviceHash(c),
    },
    select: { id: true, startedAt: true },
  });

  return c.json({ sessionId: created.id, startedAt: created.startedAt });
});

/**
 * One-time migration: users who played games before the server-authoritative
 * session flow had their stats only in localStorage. This endpoint accepts
 * those per-game-key totals, caps them, and credits gameCoinsBalance. It
 * flips User.legacyImported so the import can't be replayed.
 */
const LEGACY_PER_GAME_CAP_MULT = 2;
const LEGACY_TOTAL_CAP = 10_000;

gameRoutes.post("/import-legacy", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const rl = rateLimit(`legacy-import:${session.userId}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    c.header("Retry-After", String(Math.ceil(rl.retryAfterMs / 1000)));
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    totals?: Record<string, unknown>;
  };
  const totalsIn = body.totals;
  if (!totalsIn || typeof totalsIn !== "object") {
    return c.json({ error: "Invalid totals" }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { legacyImported: true, gameCoinsBalance: true, frozen: true },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);
  if (user.legacyImported) {
    return c.json({
      ok: true,
      alreadyImported: true,
      credited: 0,
      balance: user.gameCoinsBalance,
    });
  }

  let credited = 0;
  for (const key of VALID_GAME_KEYS) {
    const raw = Number((totalsIn as Record<string, unknown>)[key]);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const perGameCap = GAME_CONFIG[key].dailyCoinCap * LEGACY_PER_GAME_CAP_MULT;
    credited += Math.min(Math.floor(raw), perGameCap);
  }
  credited = Math.min(credited, LEGACY_TOTAL_CAP);

  const updated = await prisma.user.updateMany({
    where: { id: session.userId, legacyImported: false },
    data: {
      legacyImported: true,
      legacyImportedCoins: credited,
      gameCoinsBalance: { increment: credited },
    },
  });

  if (updated.count === 0) {
    const fresh = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { gameCoinsBalance: true },
    });
    return c.json({
      ok: true,
      alreadyImported: true,
      credited: 0,
      balance: fresh?.gameCoinsBalance ?? 0,
    });
  }

  const fresh = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { gameCoinsBalance: true },
  });
  return c.json({
    ok: true,
    alreadyImported: false,
    credited,
    balance: fresh?.gameCoinsBalance ?? 0,
  });
});

/**
 * Incremental in-session credit. Used by progressive games (word, memory)
 * to credit coins per action. Only clamped against per-session cap —
 * daily cap is not enforced so users always receive their earned coins.
 */
gameRoutes.post("/session/credit", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const body = (await c.req.json().catch(() => ({}))) as {
    sessionId?: unknown;
    deltaCoins?: unknown;
  };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const requested = Math.max(0, Math.floor(Number(body.deltaCoins) || 0));
  if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);
  if (requested === 0) return c.json({ error: "deltaCoins must be > 0" }, 400);

  const rl = rateLimit(`game:credit:${session.userId}`, 120, 60_000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests", retryAfterMs: rl.retryAfterMs }, 429);
  }

  const row = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!row || row.userId !== session.userId) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (row.finishedAt) {
    return c.json({ error: "Session already finished" }, 409);
  }

  const cfg = GAME_CONFIG[row.gameKey as GameKey];

  // Only enforce per-session cap — no daily cap.
  const sessionRemaining = Math.max(0, cfg.maxCoinsPerSession - row.coinsEarned);
  const credited = Math.min(requested, sessionRemaining);

  if (credited === 0) {
    const fresh = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { gameCoinsBalance: true },
    });
    return c.json({
      credited: 0,
      sessionTotal: row.coinsEarned,
      balance: fresh?.gameCoinsBalance ?? 0,
      capped: true,
      reason: "session_cap",
    });
  }

  const [updatedSession, updatedUser] = await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: sessionId },
      data: { coinsEarned: { increment: credited } },
      select: { coinsEarned: true },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { gameCoinsBalance: { increment: credited } },
      select: { gameCoinsBalance: true },
    }),
  ]);

  return c.json({
    credited,
    sessionTotal: updatedSession.coinsEarned,
    balance: updatedUser.gameCoinsBalance,
    capped: credited < requested,
  });
});

/** Finish a game session. Server computes and credits coinsEarned. */
gameRoutes.post("/session/finish", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const body = (await c.req.json().catch(() => ({}))) as {
    sessionId?: unknown;
    score?: unknown;
    meta?: unknown;
  };
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const score = Number.isFinite(Number(body.score)) ? Number(body.score) : 0;
  if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

  const rl = rateLimit(`game:finish:${session.userId}`, 30, 60_000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests", retryAfterMs: rl.retryAfterMs }, 429);
  }

  const row = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  if (!row || row.userId !== session.userId) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (row.finishedAt) {
    return c.json({ error: "Session already finished" }, 409);
  }

  const cfg = GAME_CONFIG[row.gameKey as GameKey];
  const now = Date.now();
  const elapsed = now - row.startedAt.getTime();
  if (elapsed < cfg.minDurationMs) {
    return c.json(
      { error: "Session too short", minDurationMs: cfg.minDurationMs },
      400,
    );
  }

  // Compute final coins. Progressive games (word, memory) already have
  // row.coinsEarned > 0 from /credit calls. For one-shot games it's 0.
  // Award the larger of already-credited and score-based total, both
  // clamped by per-session cap only — no daily cap.
  const rawCoins = scoreToCoins(row.gameKey as GameKey, score);
  const sessionCap = cfg.maxCoinsPerSession;
  const scoreBased = Math.min(rawCoins, sessionCap);
  const bonus = Math.max(0, scoreBased - row.coinsEarned);
  const coinsEarned = row.coinsEarned + bonus;
  const creditDelta = bonus;

  const metaJson =
    body.meta && typeof body.meta === "object"
      ? JSON.stringify(body.meta).slice(0, 2_000)
      : null;

  const [updatedSession, updatedUser] = await prisma.$transaction([
    prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        finishedAt: new Date(now),
        score: Math.max(0, Math.floor(Math.min(score, cfg.maxScore))),
        coinsEarned,
        meta: metaJson,
      },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { gameCoinsBalance: { increment: creditDelta } },
      select: { gameCoinsBalance: true },
    }),
  ]);

  return c.json({
    sessionId: updatedSession.id,
    coinsEarned,
    balance: updatedUser.gameCoinsBalance,
    capped: false,
  });
});
