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

/** Server-authoritative game-coin balance + today's earnings by game. */
gameRoutes.get("/balance", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [user, todayByGame] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { gameCoinsBalance: true },
    }),
    prisma.gameSession.groupBy({
      by: ["gameKey"],
      where: {
        userId: session.userId,
        finishedAt: { gte: startOfDay },
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

  // Per-user per-game start rate limit — guards against bulk session allocation.
  const rl = rateLimit(`game:start:${session.userId}:${gameKey}`, 20, 60_000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests", retryAfterMs: rl.retryAfterMs }, 429);
  }

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

  // Daily cap: refuse if already at the per-game daily coin cap.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayAgg = await prisma.gameSession.aggregate({
    where: {
      userId: session.userId,
      gameKey,
      finishedAt: { gte: startOfDay },
    },
    _sum: { coinsEarned: true },
  });
  if ((todayAgg._sum.coinsEarned ?? 0) >= cfg.dailyCoinCap) {
    return c.json({ error: "Daily cap reached for this game" }, 403);
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

  // Compute coins server-side; clamp against remaining daily budget.
  const rawCoins = scoreToCoins(row.gameKey as GameKey, score);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayAgg = await prisma.gameSession.aggregate({
    where: {
      userId: session.userId,
      gameKey: row.gameKey,
      finishedAt: { gte: startOfDay },
    },
    _sum: { coinsEarned: true },
  });
  const todaySoFar = todayAgg._sum.coinsEarned ?? 0;
  const remainingToday = Math.max(0, cfg.dailyCoinCap - todaySoFar);
  const coinsEarned = Math.min(rawCoins, remainingToday);

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
      data: { gameCoinsBalance: { increment: coinsEarned } },
      select: { gameCoinsBalance: true },
    }),
  ]);

  return c.json({
    sessionId: updatedSession.id,
    coinsEarned,
    balance: updatedUser.gameCoinsBalance,
    capped: rawCoins > coinsEarned,
  });
});
