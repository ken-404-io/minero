import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAdmin } from "../lib/session.js";
import {
  withdrawalApprovedHtml,
  withdrawalRejectedHtml,
} from "../lib/email.js";
import { enqueue, QUEUE_EMAIL } from "../lib/queue.js";
import {
  getConfig,
  setConfigValue,
  DEFAULTS,
  type PlanConfigMap,
} from "../lib/config.js";
import { createNotification, broadcastNotification } from "../lib/notifications.js";

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
    legacyImportedUsers,
    legacyImportedCoinsAgg,
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
    prisma.user.count({ where: { legacyImported: true } }),
    prisma.user.aggregate({ _sum: { legacyImportedCoins: true } }),
  ]);

  const onlineSince = new Date(Date.now() - 2 * 60 * 1000);
  const [activeTodayGroups, onlineUsers] = await Promise.all([
    prisma.claim.groupBy({
      by: ["userId"],
      where: { claimedAt: { gte: startOfDay } },
      orderBy: { userId: "asc" },
    }),
    prisma.user.count({ where: { lastSeenAt: { gte: onlineSince } } }),
  ]);

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
    onlineUsers,
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
    legacyImportedUsers,
    legacyImportedCoinsTotal: legacyImportedCoinsAgg._sum.legacyImportedCoins ?? 0,
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
        lastSeenAt: true,
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

adminRoutes.get("/users/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const id = c.req.param("id");

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      balance: true,
      pendingBalance: true,
      gameCoinsBalance: true,
      plan: true,
      role: true,
      frozen: true,
      createdAt: true,
      legacyImported: true,
      legacyImportedCoins: true,
      _count: { select: { claims: true, earnings: true, withdrawals: true, referralsGiven: true } },
    },
  });
  if (!user) return c.json({ error: "Not found" }, 404);

  const [recentClaims, recentWithdrawals] = await Promise.all([
    prisma.claim.findMany({
      where: { userId: id },
      orderBy: { claimedAt: "desc" },
      take: 20,
      select: { id: true, amount: true, claimedAt: true },
    }),
    prisma.withdrawal.findMany({
      where: { userId: id },
      orderBy: { requestedAt: "desc" },
      take: 20,
      select: {
        id: true,
        amount: true,
        method: true,
        accountNumber: true,
        status: true,
        requestedAt: true,
        processedAt: true,
        adminNote: true,
      },
    }),
  ]);

  return c.json({ user, recentClaims, recentWithdrawals });
});

const userPatchSchema = z.object({
  frozen: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional(),
  plan: z.enum(["free", "paid"]).optional(),
  balanceAdjustment: z.number().optional(),
  balanceReason: z.string().max(200).optional(),
  gameCoinsAdjustment: z.number().int().optional(),
  gameCoinsReason: z.string().max(200).optional(),
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

  const {
    frozen,
    role,
    plan,
    balanceAdjustment,
    balanceReason,
    gameCoinsAdjustment,
    gameCoinsReason,
  } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return c.json({ error: "User not found" }, 404);

  await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (frozen !== undefined) updateData.frozen = frozen;
    if (role !== undefined) updateData.role = role;
    if (plan !== undefined) updateData.plan = plan;

    if (balanceAdjustment !== undefined && balanceAdjustment !== 0) {
      updateData.balance = { increment: balanceAdjustment };
      // Log as an earning for audit trail
      await tx.earning.create({
        data: {
          userId: id,
          amount: Math.abs(balanceAdjustment),
          type: balanceReason
            ? `admin_adjustment: ${balanceReason.slice(0, 100)}`
            : "admin_adjustment",
          status: balanceAdjustment > 0 ? "approved" : "rejected",
        },
      });
    }

    if (gameCoinsAdjustment !== undefined && gameCoinsAdjustment !== 0) {
      // Block deductions that would underflow the balance.
      const fresh = await tx.user.findUnique({
        where: { id },
        select: { gameCoinsBalance: true },
      });
      const current = fresh?.gameCoinsBalance ?? 0;
      if (gameCoinsAdjustment < 0 && current + gameCoinsAdjustment < 0) {
        throw new Error(
          `gameCoinsAdjustment of ${gameCoinsAdjustment} would underflow balance ${current}`,
        );
      }
      updateData.gameCoinsBalance = { increment: gameCoinsAdjustment };
      // Audit trail: a finished GameSession with gameKey="admin_adjust"
      // and the reason in meta. Keeps every coin movement in one table.
      await tx.gameSession.create({
        data: {
          userId: id,
          gameKey: "admin_adjust",
          startedAt: new Date(),
          finishedAt: new Date(),
          score: 0,
          coinsEarned: gameCoinsAdjustment,
          meta: JSON.stringify({
            adjustedBy: guard.userId,
            reason: gameCoinsReason ?? null,
          }),
        },
      });
    }

    await tx.user.update({ where: { id }, data: updateData });

    if (frozen === true) {
      await tx.withdrawal.updateMany({
        where: { userId: id, status: "pending" },
        data: { status: "rejected", adminNote: "Account frozen" },
      });
    }
  });

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      frozen: true,
      role: true,
      plan: true,
      balance: true,
      gameCoinsBalance: true,
    },
  });

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
    await enqueue(QUEUE_EMAIL, {
      to: withdrawal.user.email,
      subject: "Withdrawal Approved — Minero",
      html: withdrawalApprovedHtml({
        name: withdrawal.user.name,
        amount: withdrawal.amount,
        method: withdrawal.method,
        accountNumber: withdrawal.accountNumber,
      }),
    });
    await createNotification({
      userId: withdrawal.userId,
      type: "withdrawal_approved",
      title: "Withdrawal approved",
      body: `Your ₱${withdrawal.amount.toFixed(2)} withdrawal to ${withdrawal.method.toUpperCase()} has been approved and is on its way.`,
      link: "/withdraw",
      createdBy: guard.userId,
    });
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
    await enqueue(QUEUE_EMAIL, {
      to: withdrawal.user.email,
      subject: "Withdrawal Update — Minero",
      html: withdrawalRejectedHtml({
        name: withdrawal.user.name,
        amount: withdrawal.amount,
        adminNote,
      }),
    });
    await createNotification({
      userId: withdrawal.userId,
      type: "withdrawal_rejected",
      title: "Withdrawal rejected",
      body: adminNote
        ? `Your ₱${withdrawal.amount.toFixed(2)} withdrawal was rejected: ${adminNote}. The amount has been refunded to your balance.`
        : `Your ₱${withdrawal.amount.toFixed(2)} withdrawal was rejected. The amount has been refunded to your balance.`,
      link: "/withdraw",
      createdBy: guard.userId,
    });
  }

  return c.json({ ok: true });
});

adminRoutes.post("/referrals/approve", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  // ?force=true approves ALL pending referral earnings regardless of age.
  const force = c.req.query("force") === "true";

  const cfg = await getConfig();
  const where = force
    ? { type: "referral", status: "pending" }
    : { type: "referral", status: "pending", createdAt: { lte: new Date(Date.now() - cfg.referralApprovalWindowMs) } };

  const pendingCommissions = await prisma.earning.findMany({ where });

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
//  Notifications — admin broadcast / targeted send
// ============================================================

const adminNotificationSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  link: z.string().max(500).optional(),
  /** Send to a single user. Mutually exclusive with `broadcast`. */
  userId: z.string().min(1).optional(),
  /** Send to every non-frozen user. */
  broadcast: z.boolean().optional(),
});

adminRoutes.post("/notifications", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = adminNotificationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { title, body: msgBody, link, userId, broadcast } = parsed.data;

  if (!userId && !broadcast) {
    return c.json({ error: "Provide a userId or set broadcast: true" }, 400);
  }
  if (userId && broadcast) {
    return c.json({ error: "Choose either userId or broadcast, not both" }, 400);
  }

  if (userId) {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) return c.json({ error: "User not found" }, 404);
    await createNotification({
      userId,
      type: "admin",
      title,
      body: msgBody,
      link: link || null,
      createdBy: guard.userId,
    });
    return c.json({ ok: true, sent: 1 });
  }

  const sent = await broadcastNotification({
    type: "admin",
    title,
    body: msgBody,
    link: link || null,
    createdBy: guard.userId,
  });
  return c.json({ ok: true, sent });
});

/** Recent admin-sent notifications, grouped by (createdAt, title, body) so a
 *  broadcast looks like one row regardless of how many users received it. */
adminRoutes.get("/notifications", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? "20")));

  // Pull recent admin notifications, dedupe by (title, body, second-truncated createdAt)
  // because broadcasts fan out one row per user.
  const recent = await prisma.notification.findMany({
    where: { type: "admin" },
    orderBy: { createdAt: "desc" },
    take: limit * 50,
    select: { id: true, title: true, body: true, link: true, createdAt: true, createdBy: true, readAt: true },
  });

  const groups = new Map<string, {
    title: string;
    body: string;
    link: string | null;
    sentAt: Date;
    sentBy: string | null;
    recipients: number;
    reads: number;
  }>();

  for (const n of recent) {
    const bucket = Math.floor(n.createdAt.getTime() / 1000);
    const key = `${bucket}|${n.title}|${n.body}`;
    const existing = groups.get(key);
    if (existing) {
      existing.recipients += 1;
      if (n.readAt) existing.reads += 1;
    } else {
      groups.set(key, {
        title: n.title,
        body: n.body,
        link: n.link,
        sentAt: n.createdAt,
        sentBy: n.createdBy,
        recipients: 1,
        reads: n.readAt ? 1 : 0,
      });
    }
    if (groups.size >= limit) break;
  }

  return c.json({ notifications: Array.from(groups.values()) });
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
  ratePerClaim: z.number().min(0).max(10_000),
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
  // Site-wide controls
  maintenanceMode: z.boolean().optional(),
  announcementBanner: z.string().max(500).optional(),
  registrationEnabled: z.boolean().optional(),
  claimsEnabled: z.boolean().optional(),
  withdrawalsEnabled: z.boolean().optional(),
});

// ============================================================
//  Online users
// ============================================================

adminRoutes.get("/online", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const since = new Date(Date.now() - 2 * 60 * 1000); // 2-minute window

  const users = await prisma.user.findMany({
    where: { lastSeenAt: { gte: since } },
    select: {
      id: true,
      name: true,
      email: true,
      plan: true,
      balance: true,
      lastSeenAt: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  return c.json({ users, total: users.length });
});

// ============================================================
//  Leaderboard — top users by wallet balance
// ============================================================

adminRoutes.get("/leaderboard", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 50;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        balance: true,
        pendingBalance: true,
        frozen: true,
        lastSeenAt: true,
        createdAt: true,
      },
      orderBy: { balance: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count(),
  ]);

  return c.json({ users, total, page, pages: Math.ceil(total / limit) });
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
  if (updates.maintenanceMode !== undefined)
    await setConfigValue("maintenanceMode", updates.maintenanceMode ? "1" : "0", guard.userId);
  if (updates.announcementBanner !== undefined)
    await setConfigValue("announcementBanner", updates.announcementBanner, guard.userId);
  if (updates.registrationEnabled !== undefined)
    await setConfigValue("registrationEnabled", updates.registrationEnabled ? "1" : "0", guard.userId);
  if (updates.claimsEnabled !== undefined)
    await setConfigValue("claimsEnabled", updates.claimsEnabled ? "1" : "0", guard.userId);
  if (updates.withdrawalsEnabled !== undefined)
    await setConfigValue("withdrawalsEnabled", updates.withdrawalsEnabled ? "1" : "0", guard.userId);

  const cfg = await getConfig();
  return c.json({ ok: true, config: cfg });
});

// ============================================================
//  Problem Reports
// ============================================================

const REPORTS_PAGE_SIZE = 20;

adminRoutes.get("/reports", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const status = c.req.query("status") ?? "open";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));

  const where = status === "all" ? {} : { status };

  const [reports, total] = await Promise.all([
    prisma.problemReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REPORTS_PAGE_SIZE,
      take: REPORTS_PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.problemReport.count({ where }),
  ]);

  return c.json({
    reports,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / REPORTS_PAGE_SIZE)),
  });
});

adminRoutes.patch("/reports/:id", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { action?: unknown };

  if (body.action !== "dismiss") {
    return c.json({ error: 'action must be "dismiss"' }, 400);
  }

  const report = await prisma.problemReport.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!report) return c.json({ error: "Not found" }, 404);
  if (report.status !== "open") return c.json({ error: "Report already dismissed" }, 409);

  await prisma.problemReport.update({
    where: { id },
    data: {
      status: "dismissed",
      dismissedAt: new Date(),
      dismissedBy: guard.userId,
    },
  });

  return c.json({ ok: true });
});
