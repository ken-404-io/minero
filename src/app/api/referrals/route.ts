import { NextResponse } from "next/server";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { referralCode: true, pendingBalance: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json({
    referralCode: user.referralCode,
    referrals,
    commissionEarnings,
    totalApprovedCommission: totalCommission._sum.amount ?? 0,
  });
}
