import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAdmin } from "../lib/session.js";
import {
  emailProvider,
  withdrawalApprovedHtml,
  withdrawalRejectedHtml,
} from "../lib/email.js";
import {
  getConfig,
  setConfigValue,
  DEFAULTS,
  type PlanConfigMap,
} from "../lib/config.js";

export const adminRoutes = new Hono();

// ============================================================
//  Stats / revenue dashboard
// ============================================================

adminRoutes.get("/stats", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    frozenUsers,
    totalPaidOut,
    pendingWithdrawals,
    pendingWithdrawalAmount,
    todayPayouts,
    monthPayouts,
    openAlerts,
    pendingPlans,
    todayImpressions,
    monthImpressions,
    todayRevenue,
    monthRevenue,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { frozen: true } }),
    prisma.withdrawal.aggregate({ where: { status: "approved" }, _sum: { amount: true } }),
    prisma.withdrawal.count({ where: { status: "pending" } }),
    prisma.withdrawal.aggregate({ where: { status: "pending" }, _sum: { amount: true } }),
    prisma.earning.aggregate({
      where: { createdAt: { gte: startOfDay }, status: "approved" },
      _sum: { amount: true },
    }),
    prisma.earning.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: "approved" },
      _sum: { amount: true },
    }),
    prisma.fraudAlert.count({ where: { status: "open" } }),
    prisma.planLog.count({ where: { status: "pending" } }),
    prisma.adImpression.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.adImpression.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.adImpression.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { estimatedRevenue: true },
    }),
    prisma.adImpression.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { estimatedRevenue: true },
    }),
  ]);

  const activeTodayGroups = await prisma.claim.groupBy({
    by: ["userId"],
    where: { claimedAt: { gte: startOfDay } },
    orderBy: { userId: "asc" },
  });

  const planDistribution = await prisma.user.groupBy({
    by: ["plan"],
    _count: { id: true },
    orderBy: { plan: "asc" },
  });

  const todayPayoutTotal = todayPayouts._sum.amount ?? 0;
  const todayRevenueTotal = todayRevenue._sum.estimatedRevenue ?? 0;
  const monthPayoutTotal = monthPayouts._sum.amount ?? 0;
  const monthRevenueTotal = monthRevenue._sum.estimatedRevenue ?? 0;

  return c.json({
    totalUsers,
    frozenUsers,
    activeToday: activeTodayGroups.length,
    totalPaidOut: totalPaidOut._sum.amount ?? 0,
    pendingWithdrawals,
    pendingWithdrawalAmount: pendingWithdrawalAmount._sum.amount ?? 0,
    pendingPlans,
    openAlerts,
    todayPayouts: todayPayoutTotal,
    monthPayouts: monthPayoutTotal,
    todayImpressions,
    monthImpressions,
    todayRevenue: todayRevenueTotal,
    monthRevenue: monthRevenueTotal,
    todayMargin: todayRevenueTotal - todayPayoutTotal,
    todayRevenueToPayoutRatio:
      todayPayoutTotal > 0 ? todayRevenueTotal / todayPayoutTotal : null,
    planDistribution,
  });
});

// ============================================================
//  Users
// ============================================================

adminRoutes.get("/users", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const search = c.req.query("search") ?? "";
  const limit = 20;

  const where = search
    ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        balance: true,
        pendingBalance: true,
        plan: true,
        role: true,
        frozen: true,
        createdAt: true,
        _count: { select: { claims: true, earnings: true, withdrawals: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return c.json({ users, total, page, pages: Math.ceil(total / limit) });
});

const userPatchSchema = z.object({
  frozen: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

adminRoutes.patch("/users/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const id = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = userPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, frozen: true, role: true },
  });

  if (parsed.data.frozen === true) {
    await prisma.withdrawal.updateMany({
      where: { userId: id, status: "pending" },
      data: { status: "rejected", adminNote: "Account frozen" },
    });
  }

  return c.json({ user });
});

// ============================================================
//  Withdrawals
// ============================================================

adminRoutes.get("/withdrawals", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const status = c.req.query("status") ?? "pending";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 20;

  const where = status === "all" ? {} : { status };

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.withdrawal.count({ where }),
  ]);

  return c.json({ withdrawals, total, page, pages: Math.ceil(total / limit) });
});

const withdrawalActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(200).optional(),
});

adminRoutes.patch("/withdrawals/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const id = c.req.param("id");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = withdrawalActionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { action, adminNote } = parsed.data;

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!withdrawal) return c.json({ error: "Not found" }, 404);
  if (withdrawal.status !== "pending") {
    return c.json({ error: "Withdrawal already processed" }, 409);
  }

  if (action === "approve") {
    await prisma.withdrawal.update({
      where: { id },
      data: { status: "approved", processedAt: new Date(), adminNote },
    });
    emailProvider
      .send({
        to: withdrawal.user.email,
        subject: "Withdrawal Approved — Minero",
        html: withdrawalApprovedHtml({
          name: withdrawal.user.name,
          amount: withdrawal.amount,
          method: withdrawal.method,
          accountNumber: withdrawal.accountNumber,
        }),
      })
      .catch((err) => console.error("[email] withdrawal approved:", err));
  } else {
    await prisma.$transaction([
      prisma.withdrawal.update({
        where: { id },
        data: { status: "rejected", processedAt: new Date(), adminNote },
      }),
      prisma.user.update({
        where: { id: withdrawal.userId },
        data: { balance: { increment: withdrawal.amount } },
      }),
    ]);
    emailProvider
      .send({
        to: withdrawal.user.email,
        subject: "Withdrawal Update — Minero",
        html: withdrawalRejectedHtml({
          name: withdrawal.user.name,
          amount: withdrawal.amount,
          adminNote,
        }),
      })
      .catch((err) => console.error("[email] withdrawal rejected:", err));
  }

  return c.json({ ok: true });
});

adminRoutes.post("/referrals/approve", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const cfg = await getConfig();
  const cutoff = new Date(Date.now() - cfg.referralApprovalWindowMs);

  const pendingCommissions = await prisma.earning.findMany({
    where: { type: "referral", status: "pending", createdAt: { lte: cutoff } },
  });

  if (pendingCommissions.length === 0) return c.json({ approved: 0 });

  await prisma.$transaction(async (tx) => {
    for (const e of pendingCommissions) {
      await tx.earning.update({ where: { id: e.id }, data: { status: "approved" } });
      await tx.user.update({
        where: { id: e.userId },
        data: {
          balance: { increment: e.amount },
          pendingBalance: { decrement: e.amount },
        },
      });
    }
  });

  return c.json({ approved: pendingCommissions.length });
});

// ============================================================
//  Fraud alerts
// ============================================================

adminRoutes.get("/fraud-alerts", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const status = c.req.query("status") ?? "open";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 20;
  const where = status === "all" ? {} : { status };

  const [alerts, total] = await Promise.all([
    prisma.fraudAlert.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, frozen: true } } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.fraudAlert.count({ where }),
  ]);

  return c.json({ alerts, total, page, pages: Math.ceil(total / limit) });
});

const alertResolveSchema = z.object({
  action: z.enum(["resolve", "dismiss", "freeze_user"]),
  adminNote: z.string().max(500).optional(),
});

adminRoutes.patch("/fraud-alerts/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const id = c.req.param("id");

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = alertResolveSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { action, adminNote } = parsed.data;
  const alert = await prisma.fraudAlert.findUnique({ where: { id } });
  if (!alert) return c.json({ error: "Not found" }, 404);

  const nextStatus = action === "dismiss" ? "dismissed" : "resolved";

  if (action === "freeze_user" && alert.userId) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: alert.userId }, data: { frozen: true } }),
      prisma.withdrawal.updateMany({
        where: { userId: alert.userId, status: "pending" },
        data: { status: "rejected", adminNote: "Account frozen (fraud alert)" },
      }),
      prisma.fraudAlert.update({
        where: { id },
        data: {
          status: nextStatus,
          resolvedAt: new Date(),
          resolvedBy: guard.userId,
          adminNote: adminNote ?? "User frozen",
        },
      }),
    ]);
    return c.json({ ok: true, frozen: true });
  }

  await prisma.fraudAlert.update({
    where: { id },
    data: {
      status: nextStatus,
      resolvedAt: new Date(),
      resolvedBy: guard.userId,
      adminNote,
    },
  });
  return c.json({ ok: true });
});

// ============================================================
//  Plan upgrade queue (pending plan purchases)
// ============================================================

adminRoutes.get("/plans", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const status = c.req.query("status") ?? "pending";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 20;
  const where = status === "all" ? {} : { status };

  const [plans, total] = await Promise.all([
    prisma.planLog.findMany({
      where,
      include: { user: { select: { name: true, email: true, plan: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.planLog.count({ where }),
  ]);

  return c.json({ plans, total, page, pages: Math.ceil(total / limit) });
});

const planActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(500).optional(),
});

adminRoutes.patch("/plans/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const id = c.req.param("id");

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = planActionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { action, adminNote } = parsed.data;
  const log = await prisma.planLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, plan: true, frozen: true } } },
  });
  if (!log) return c.json({ error: "Not found" }, 404);
  if (log.status !== "pending") {
    return c.json({ error: "Already processed" }, 409);
  }

  if (action === "approve") {
    if (log.user.frozen) {
      return c.json({ error: "User is frozen; cannot upgrade" }, 400);
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: log.user.id }, data: { plan: log.plan } }),
      prisma.planLog.update({
        where: { id: log.id },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: guard.userId,
          adminNote,
        },
      }),
    ]);
  } else {
    await prisma.planLog.update({
      where: { id: log.id },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: guard.userId,
        adminNote,
      },
    });
  }

  return c.json({ ok: true });
});

// ============================================================
//  Platform configuration (live rates, caps)
// ============================================================

adminRoutes.get("/config", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const cfg = await getConfig();
  return c.json({ config: cfg, defaults: DEFAULTS });
});

const planSchema = z.object({
  label: z.string().min(1).max(50),
  ratePerClaim: z.number().min(0).max(1),
  dailyCap: z.number().min(0).max(10_000),
  price: z.number().min(0).max(100_000),
});

const configUpdateSchema = z.object({
  plans: z
    .object({
      free: planSchema,
      paid: planSchema,
    })
    .optional(),
  claimIntervalMs: z.number().int().min(60_000).max(6 * 60 * 60 * 1000).optional(),
  referralCommissionRate: z.number().min(0).max(1).optional(),
  referralApprovalWindowMs: z.number().int().min(0).max(14 * 24 * 60 * 60 * 1000).optional(),
  maxReferralsPerDay: z.number().int().min(1).max(1000).optional(),
  withdrawalMinimum: z.number().min(0).max(100_000).optional(),
  estimatedAdRevenuePerClaim: z.number().min(0).max(10).optional(),
});

adminRoutes.put("/config", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = configUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const updates = parsed.data;

  if (updates.plans) {
    await setConfigValue("plans", updates.plans as PlanConfigMap, guard.userId);
  }
  if (updates.claimIntervalMs !== undefined)
    await setConfigValue("claimIntervalMs", updates.claimIntervalMs, guard.userId);
  if (updates.referralCommissionRate !== undefined)
    await setConfigValue("referralCommissionRate", updates.referralCommissionRate, guard.userId);
  if (updates.referralApprovalWindowMs !== undefined)
    await setConfigValue("referralApprovalWindowMs", updates.referralApprovalWindowMs, guard.userId);
  if (updates.maxReferralsPerDay !== undefined)
    await setConfigValue("maxReferralsPerDay", updates.maxReferralsPerDay, guard.userId);
  if (updates.withdrawalMinimum !== undefined)
    await setConfigValue("withdrawalMinimum", updates.withdrawalMinimum, guard.userId);
  if (updates.estimatedAdRevenuePerClaim !== undefined)
    await setConfigValue("estimatedAdRevenuePerClaim", updates.estimatedAdRevenuePerClaim, guard.userId);

  const cfg = await getConfig();
  return c.json({ ok: true, config: cfg });
});
