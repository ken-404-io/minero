import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";

export const referralsRoutes = new Hono();

referralsRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { referralCode: true, pendingBalance: true },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const referrals = await prisma.referral.findMany({
    where: { referrerId: session.userId },
    include: {
      referred: { select: { name: true, email: true, plan: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const commissionEarnings = await prisma.earning.findMany({
    where: { userId: session.userId, type: "referral" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalCommission = await prisma.earning.aggregate({
    where: { userId: session.userId, type: "referral", status: "approved" },
    _sum: { amount: true },
  });

  return c.json({
    referralCode: user.referralCode,
    referrals,
    commissionEarnings,
    totalApprovedCommission: totalCommission._sum.amount ?? 0,
  });
});
