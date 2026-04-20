import { NextResponse } from "next/server";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    prisma.earning.aggregate({ where: { createdAt: { gte: startOfDay }, status: "approved" }, _sum: { amount: true } }),
    prisma.earning.aggregate({ where: { createdAt: { gte: startOfMonth }, status: "approved" }, _sum: { amount: true } }),
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

  return NextResponse.json({
    totalUsers,
    activeToday: activeTodayGroups.length,
    totalPaidOut: totalPaidOut._sum.amount ?? 0,
    pendingWithdrawals,
    pendingWithdrawalAmount: pendingWithdrawalAmount._sum.amount ?? 0,
    todayPayouts: todayPayouts._sum.amount ?? 0,
    monthPayouts: monthPayouts._sum.amount ?? 0,
    planDistribution,
  });
}
