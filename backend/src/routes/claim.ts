import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import {
  getPlanConfig,
  CLAIM_INTERVAL_MS,
  REFERRAL_COMMISSION_RATE,
} from "../lib/mining.js";

export const claimRoutes = new Hono();

claimRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  const plan = getPlanConfig(user.plan);
  const now = new Date();

  const lastClaim = await prisma.claim.findFirst({
    where: { userId: user.id },
    orderBy: { claimedAt: "desc" },
  });

  if (lastClaim) {
    const elapsed = now.getTime() - lastClaim.claimedAt.getTime();
    if (elapsed < CLAIM_INTERVAL_MS) {
      return c.json({ error: "Too soon", remainingMs: CLAIM_INTERVAL_MS - elapsed }, 429);
    }
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const todayEarnings = await prisma.earning.aggregate({
    where: {
      userId: user.id,
      type: "mining",
      createdAt: { gte: startOfDay },
      status: { not: "rejected" },
    },
    _sum: { amount: true },
  });

  const todayTotal = todayEarnings._sum.amount ?? 0;
  if (todayTotal >= plan.dailyCap) {
    return c.json({ error: "Daily cap reached" }, 403);
  }

  const amount = Math.min(plan.ratePerClaim, plan.dailyCap - todayTotal);

  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    c.req.header("x-real-ip") ??
    "unknown";

  const recentSameIp = await prisma.claim.findFirst({
    where: {
      ip,
      userId: { not: user.id },
      claimedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });
  if (recentSameIp) return c.json({ error: "Claim blocked" }, 403);

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.create({
      data: { userId: user.id, amount, ip, adToken: null },
    });

    const earning = await tx.earning.create({
      data: { userId: user.id, amount, type: "mining", status: "approved" },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { balance: { increment: amount } },
    });

    if (user.referredBy) {
      const referrer = await tx.user.findUnique({ where: { id: user.referredBy } });
      if (referrer && !referrer.frozen) {
        const commission = parseFloat((amount * REFERRAL_COMMISSION_RATE).toFixed(4));
        await tx.earning.create({
          data: {
            userId: user.referredBy,
            amount: commission,
            type: "referral",
            status: "pending",
          },
        });
        await tx.user.update({
          where: { id: user.referredBy },
          data: { pendingBalance: { increment: commission } },
        });
        await tx.referral.updateMany({
          where: { referrerId: user.referredBy, referralId: user.id },
          data: { commissionTotal: { increment: commission } },
        });
      }
    }

    return { claim, earning };
  });

  return c.json({
    amount: result.earning.amount,
    newBalance: user.balance + amount,
    claimedAt: result.claim.claimedAt,
    nextClaimAt: new Date(result.claim.claimedAt.getTime() + CLAIM_INTERVAL_MS),
  });
});
