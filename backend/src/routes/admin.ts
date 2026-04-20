import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAdmin } from "../lib/session.js";
import { REFERRAL_APPROVAL_WINDOW_MS } from "../lib/mining.js";

export const adminRoutes = new Hono();

adminRoutes.get("/stats", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalPaidOut,
    pendingWithdrawals,
    pendingWithdrawalAmount,
    todayPayouts,
    monthPayouts,
  ] = await Promise.all([
    prisma.user.count(),
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

  return c.json({
    totalUsers,
    activeToday: activeTodayGroups.length,
    totalPaidOut: totalPaidOut._sum.amount ?? 0,
    pendingWithdrawals,
    pendingWithdrawalAmount: pendingWithdrawalAmount._sum.amount ?? 0,
    todayPayouts: todayPayouts._sum.amount ?? 0,
    monthPayouts: monthPayouts._sum.amount ?? 0,
    planDistribution,
  });
});

adminRoutes.get("/users", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const search = c.req.query("search") ?? "";
  const limit = 20;

  const where = search
    ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] }
    : {};

  const [users, total] = await prisma.$transaction([
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

adminRoutes.get("/withdrawals", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const status = c.req.query("status") ?? "pending";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 20;

  const where = status === "all" ? {} : { status };

  const [withdrawals, total] = await prisma.$transaction([
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

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
  if (!withdrawal) return c.json({ error: "Not found" }, 404);
  if (withdrawal.status !== "pending") {
    return c.json({ error: "Withdrawal already processed" }, 409);
  }

  if (action === "approve") {
    await prisma.withdrawal.update({
      where: { id },
      data: { status: "approved", processedAt: new Date(), adminNote },
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
  }

  return c.json({ ok: true });
});

adminRoutes.post("/referrals/approve", async (c) => {
  const guard = requireAdmin(c);
  if (guard instanceof Response) return guard;

  const cutoff = new Date(Date.now() - REFERRAL_APPROVAL_WINDOW_MS);

  const pendingCommissions = await prisma.earning.findMany({
    where: { type: "referral", status: "pending", createdAt: { lte: cutoff } },
  });

  if (pendingCommissions.length === 0) return c.json({ approved: 0 });

  await Promise.all(
    pendingCommissions.map((e) =>
      prisma.$transaction([
        prisma.earning.update({ where: { id: e.id }, data: { status: "approved" } }),
        prisma.user.update({
          where: { id: e.userId },
          data: {
            balance: { increment: e.amount },
            pendingBalance: { decrement: e.amount },
          },
        }),
      ])
    )
  );

  return c.json({ approved: pendingCommissions.length });
});
