import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";
import { redirect } from "next/navigation";
import { getPlanConfig } from "@/backend/lib/mining";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, balance: true, pendingBalance: true, plan: true, referralCode: true },
  });
  if (!user) redirect("/login");

  const plan = getPlanConfig(user.plan);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [lastClaim, todayEarnings] = await Promise.all([
    prisma.claim.findFirst({
      where: { userId: user.id },
      orderBy: { claimedAt: "desc" },
    }),
    prisma.earning.aggregate({
      where: { userId: user.id, type: "mining", createdAt: { gte: startOfDay }, status: { not: "rejected" } },
      _sum: { amount: true },
    }),
  ]);

  const referralCount = await prisma.referral.count({ where: { referrerId: user.id } });

  return (
    <DashboardClient
      user={{ ...user, balance: user.balance, pendingBalance: user.pendingBalance }}
      plan={plan}
      lastClaimAt={lastClaim?.claimedAt ?? null}
      dailyEarned={todayEarnings._sum.amount ?? 0}
      referralCount={referralCount}
    />
  );
}
