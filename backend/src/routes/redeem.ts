import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";

export const redeemRoutes = new Hono();

const COINS_PER_PESO = 2499;
const MAX_REDEEM_PESO = 100;
const DAILY_REDEEM_CAP = 100; // max ₱100 in game rewards per calendar day

redeemRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const body = (await c.req.json().catch(() => ({}))) as {
    pesoValue?: unknown;
    // coinsSpent is accepted for backwards compatibility but ignored —
    // the server derives the cost from pesoValue and checks against the
    // authoritative gameCoinsBalance. The client doesn't get to say how
    // many coins it has.
    coinsSpent?: unknown;
  };
  const pesoValue = Number(body.pesoValue);

  if (!Number.isFinite(pesoValue) || pesoValue <= 0 || pesoValue > MAX_REDEEM_PESO) {
    return c.json({ error: "Invalid peso value" }, 400);
  }

  const coinsNeeded = Math.round(pesoValue * COINS_PER_PESO);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { frozen: true, gameCoinsBalance: true },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  if (user.gameCoinsBalance < coinsNeeded) {
    return c.json(
      {
        error: "Insufficient game coins",
        balance: user.gameCoinsBalance,
        coinsNeeded,
      },
      400,
    );
  }

  // Daily cap: max DAILY_REDEEM_CAP pesos in game_reward earnings per day.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayAgg = await prisma.earning.aggregate({
    where: {
      userId: session.userId,
      type: "game_reward",
      status: { not: "rejected" },
      createdAt: { gte: startOfDay },
    },
    _sum: { amount: true },
  });
  const todayRedeemed = todayAgg._sum.amount ?? 0;
  if (todayRedeemed + pesoValue > DAILY_REDEEM_CAP) {
    return c.json(
      {
        error: "Daily redemption limit reached",
        remainingToday: Math.max(0, DAILY_REDEEM_CAP - todayRedeemed),
      },
      403,
    );
  }

  // Atomic: check-and-deduct coins, then credit wallet + log earning.
  // The `gameCoinsBalance: { gte: coinsNeeded }` guard in updateMany prevents
  // double-spend under concurrent requests.
  const result = await prisma.$transaction(async (tx) => {
    const deduct = await tx.user.updateMany({
      where: { id: session.userId, gameCoinsBalance: { gte: coinsNeeded } },
      data: { gameCoinsBalance: { decrement: coinsNeeded } },
    });
    if (deduct.count === 0) return null;

    await tx.earning.create({
      data: {
        userId: session.userId,
        amount: pesoValue,
        type: "game_reward",
        status: "approved",
      },
    });
    const updated = await tx.user.update({
      where: { id: session.userId },
      data: { balance: { increment: pesoValue } },
      select: { balance: true, gameCoinsBalance: true },
    });
    return updated;
  });

  if (!result) {
    return c.json({ error: "Insufficient game coins" }, 400);
  }

  return c.json({
    ok: true,
    pesoValue,
    coinsSpent: coinsNeeded,
    newTodayTotal: todayRedeemed + pesoValue,
    balance: result.balance,
    gameCoinsBalance: result.gameCoinsBalance,
  });
});
