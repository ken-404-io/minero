import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { getConfig, getPlanConfig } from "../lib/config.js";
import { raiseAlert } from "../lib/fraud.js";
import { getClientIp, getDeviceHash, isUntrackableIp } from "../lib/request.js";

export const claimRoutes = new Hono();

/** Latest claim for the authenticated user. Used by the dashboard to
 *  hydrate the cooldown timer on page load / refresh. */
claimRoutes.get("/last", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const cfg = await getConfig();
  const last = await prisma.claim.findFirst({
    where: { userId: session.userId },
    orderBy: { claimedAt: "desc" },
    select: { claimedAt: true },
  });

  if (!last) return c.json({ lastClaimAt: null, nextClaimAt: null });

  const nextClaimAt = new Date(last.claimedAt.getTime() + cfg.claimIntervalMs);
  return c.json({
    lastClaimAt: last.claimedAt,
    nextClaimAt,
    claimIntervalMs: cfg.claimIntervalMs,
  });
});

claimRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, frozen: true, plan: true, balance: true, lastDeviceHash: true, referredBy: true, role: true } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) {
    await raiseAlert({
      userId: user.id,
      type: "frozen_claim_attempt",
      severity: "low",
      details: { ip: getClientIp(c) },
    });
    return c.json({ error: "Account suspended" }, 403);
  }

  const cfg = await getConfig();
  const plan = await getPlanConfig(user.plan);
  const now = new Date();
  const ip = getClientIp(c);
  const deviceHash = getDeviceHash(c);

  // 10-minute cooldown check
  const lastClaim = await prisma.claim.findFirst({
    where: { userId: user.id },
    orderBy: { claimedAt: "desc" },
  });
  if (lastClaim) {
    const elapsed = now.getTime() - lastClaim.claimedAt.getTime();
    if (elapsed < cfg.claimIntervalMs) {
      return c.json({ error: "Too soon", remainingMs: cfg.claimIntervalMs - elapsed }, 429);
    }
  }

  // Daily cap
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
  if (todayTotal >= plan.dailyCap) return c.json({ error: "Daily cap reached" }, 403);

  const amount = Math.min(plan.ratePerClaim, plan.dailyCap - todayTotal);

  const isAdmin = user.role === "admin";

  // Fraud checks — skipped for admins and untrackable IPs (loopback/dev/proxies).
  if (!isAdmin && !isUntrackableIp(ip)) {
    // Same IP + same device = strongest fraud signal → block.
    // IP alone is too broad (shared routers, mobile carriers, offices).
    if (deviceHash) {
      const sameIpAndDevice = await prisma.claim.findFirst({
        where: {
          ip,
          deviceHash,
          userId: { not: user.id },
          claimedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      });
      if (sameIpAndDevice) {
        await raiseAlert({
          userId: user.id,
          type: "duplicate_device",
          severity: "high",
          details: { ip, deviceHash, otherClaimId: sameIpAndDevice.id },
        });
        return c.json({ error: "Claim blocked" }, 403);
      }
    }

    // Same IP only (no device match) → flag for review but allow the claim.
    const recentSameIp = await prisma.claim.findFirst({
      where: {
        ip,
        userId: { not: user.id },
        claimedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
      },
    });
    if (recentSameIp) {
      await raiseAlert({
        userId: user.id,
        type: "duplicate_ip",
        severity: "low",
        details: { ip, otherClaimId: recentSameIp.id },
      });
      // Not blocked — shared IPs are common (NAT, mobile carriers, offices).
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.claim.create({
      data: { userId: user.id, amount, ip, deviceHash },
    });
    const earning = await tx.earning.create({
      data: { userId: user.id, amount, type: "mining", status: "approved" },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: amount },
        lastDeviceHash: deviceHash ?? undefined,
      },
    });

    if (user.referredBy) {
      const referrer = await tx.user.findUnique({ where: { id: user.referredBy } });
      if (referrer && !referrer.frozen) {
        const commission = parseFloat((amount * cfg.referralCommissionRate).toFixed(4));
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
    nextClaimAt: new Date(result.claim.claimedAt.getTime() + cfg.claimIntervalMs),
  });
});
