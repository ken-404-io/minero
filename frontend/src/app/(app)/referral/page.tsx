import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import ReferralClient from "./ReferralClient";

type Me = {
  user: { pendingBalance: number; balance: number };
};

type Referral = {
  id: string;
  commissionTotal: number;
  createdAt: string;
  referred: { name: string; plan: string; createdAt: string };
};

type Commission = {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
};

type ReferralsResp = {
  referralCode: string;
  referrals: Referral[];
  commissionEarnings: Commission[];
  totalApprovedCommission: number;
};

export default async function ReferralPage() {
  const [me, data] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<ReferralsResp>("/referrals"),
  ]);

  if (!me) redirect("/login");

  return (
    <ReferralClient
      referralCode={data?.referralCode ?? ""}
      referrals={data?.referrals ?? []}
      commissions={data?.commissionEarnings ?? []}
      totalApproved={data?.totalApprovedCommission ?? 0}
      pendingCommission={me.user.pendingBalance}
    />
  );
}
