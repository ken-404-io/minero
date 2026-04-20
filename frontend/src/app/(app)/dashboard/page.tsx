import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import { getPlanConfig } from "@/lib/mining";
import DashboardClient from "./DashboardClient";

type Me = {
  user: {
    id: string;
    name: string;
    balance: number;
    pendingBalance: number;
    plan: string;
    referralCode: string;
  };
};

type Earning = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
};

type EarningsResp = {
  earnings: Earning[];
  total: number;
  page: number;
  pages: number;
};

type Referral = { id: string };

type ReferralsResp = {
  referralCode: string;
  referrals: Referral[];
};

type LastClaimResp = {
  lastClaimAt: string | null;
  nextClaimAt: string | null;
  claimIntervalMs?: number;
};

export default async function DashboardPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  const user = me.user;
  const plan = getPlanConfig(user.plan);

  const [earningsData, referralsData, lastClaimData] = await Promise.all([
    apiJson<EarningsResp>("/earnings?page=1"),
    apiJson<ReferralsResp>("/referrals"),
    apiJson<LastClaimResp>("/claim/last"),
  ]);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const dailyEarned =
    earningsData?.earnings
      .filter(
        (e) =>
          e.type === "mining" &&
          e.status !== "rejected" &&
          new Date(e.createdAt).getTime() >= startOfDay.getTime()
      )
      .reduce((sum, e) => sum + e.amount, 0) ?? 0;

  const referralCount = referralsData?.referrals.length ?? 0;
  const lastClaimAt: string | null = lastClaimData?.lastClaimAt ?? null;

  return (
    <DashboardClient
      user={{
        id: user.id,
        name: user.name,
        balance: user.balance,
        pendingBalance: user.pendingBalance,
        plan: user.plan,
        referralCode: user.referralCode,
      }}
      plan={plan}
      lastClaimAt={lastClaimAt}
      dailyEarned={dailyEarned}
      referralCount={referralCount}
    />
  );
}
