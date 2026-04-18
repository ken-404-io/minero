import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import ReferralClient from "./ReferralClient";

export default async function ReferralPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { referralCode: true, pendingBalance: true, balance: true },
  });
  if (!user) redirect("/login");

  const referrals = await prisma.referral.findMany({
    where: { referrerId: session.userId },
    include: { referred: { select: { name: true, plan: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  const commissions = await prisma.earning.findMany({
    where: { userId: session.userId, type: "referral" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const totalApproved = await prisma.earning.aggregate({
    where: { userId: session.userId, type: "referral", status: "approved" },
    _sum: { amount: true },
  });

  return (
    <ReferralClient
      referralCode={user.referralCode}
      referrals={referrals}
      commissions={commissions}
      totalApproved={totalApproved._sum.amount ?? 0}
      pendingCommission={user.pendingBalance}
    />
  );
}
