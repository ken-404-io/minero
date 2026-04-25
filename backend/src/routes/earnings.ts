import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";

export const earningsRoutes = new Hono();

earningsRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 20;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [earnings, total, approvedAgg, todayMiningAgg] = await Promise.all([
    prisma.earning.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.earning.count({ where: { userId: session.userId } }),
    prisma.earning.aggregate({
      where: { userId: session.userId, status: "approved" },
      _sum: { amount: true },
    }),
    // Server-side aggregation so paginated callers (dashboard) can show
    // an accurate "earned today" without scanning the full ledger client-side.
    prisma.earning.aggregate({
      where: {
        userId: session.userId,
        type: "mining",
        status: { not: "rejected" },
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    }),
  ]);

  const approvedTotal = approvedAgg._sum.amount ?? 0;
  const todayMiningTotal = todayMiningAgg._sum.amount ?? 0;

  return c.json({
    earnings,
    total,
    page,
    pages: Math.ceil(total / limit),
    approvedTotal,
    todayMiningTotal,
  });
});
