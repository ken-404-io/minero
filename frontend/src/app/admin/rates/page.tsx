import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminRatesClient from "./AdminRatesClient";

type Me = { user: { role: string } };

type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };
type PlanMap = Record<"free" | "paid", PlanConfig>;

type ConfigResp = {
  config: {
    plans: PlanMap;
    claimIntervalMs: number;
    referralCommissionRate: number;
    referralApprovalWindowMs: number;
    maxReferralsPerDay: number;
    withdrawalMinimum: number;
    withdrawGateReferralsRequired: number;
    estimatedAdRevenuePerClaim: number;
  };
  defaults: ConfigResp["config"];
};

export default async function AdminRatesPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const data = await apiJson<ConfigResp>("/admin/config");
  if (!data) return <div className="p-6">Failed to load config.</div>;

  return <AdminRatesClient config={data.config} defaults={data.defaults} />;
}
