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

  const body = (await c.req.json()) as { coinsSpent?: unknown; pesoValue?: unknown };
  const coinsSpent = Number(body.coinsSpent);
  const pesoValue = Number(body.pesoValue);

  if (!Number.isFinite(coinsSpent) || coinsSpent <= 0) {
    return c.json({ error: "Invalid coins amount" }, 400);
  }
  if (!Number.isFinite(pesoValue) || pesoValue <= 0 || pesoValue > MAX_REDEEM_PESO) {
    return c.json({ error: "Invalid peso value" }, 400);
  }

  // Verify conversion rate (allow ±1 coin rounding tolerance)
  const expectedCoins = Math.round(pesoValue * COINS_PER_PESO);
  if (Math.abs(expectedCoins - coinsSpent) > 1) {
    return c.json({ error: "Conversion rate mismatch" }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { frozen: true },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  // Daily cap: max DAILY_REDEEM_CAP pesos in game_reward earnings per day
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
    return c.json({ error: "Daily redemption limit reached", remainingToday: Math.max(0, DAILY_REDEEM_CAP - todayRedeemed) }, 403);
  }

  await prisma.$transaction([
    prisma.earning.create({
      data: {
        userId: session.userId,
        amount: pesoValue,
        type: "game_reward",
        status: "approved",
      },
    }),
    prisma.user.update({
      where: { id: session.userId },
      data: { balance: { increment: pesoValue } },
    }),
  ]);

  return c.json({ ok: true, pesoValue, newTodayTotal: todayRedeemed + pesoValue });
});
