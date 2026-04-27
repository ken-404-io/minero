import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import MeClient from "./MeClient";

type Me = {
  user: {
    id: string;
    name: string;
    email: string;
    plan: string;
    role: string;
    referralCode: string | null;
    createdAt: string;
  };
};

type LastClaimResp = { lastClaimAt: string | null; nextClaimAt: string | null };
type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };
type PublicConfig = { plans: Record<string, PlanConfig>; claimIntervalMs: number; withdrawalMinimum: number };

export default async function MePage() {
  const [me, lastClaimData, configData] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<LastClaimResp>("/claim/last"),
    apiJson<PublicConfig>("/config"),
  ]);
  if (!me) redirect("/login");

  const planLabel = configData?.plans[me.user.plan]?.label ?? "Free (with ads)";
  const claimIntervalMs = configData?.claimIntervalMs ?? 10 * 60 * 1000;

  return (
    <MeClient
      user={{
        id: me.user.id,
        name: me.user.name,
        email: me.user.email,
        role: me.user.role,
        referralCode: me.user.referralCode,
        createdAt: me.user.createdAt,
      }}
      planLabel={planLabel}
      claimIntervalMs={claimIntervalMs}
      lastClaimAt={lastClaimData?.lastClaimAt ?? null}
    />
  );
}
