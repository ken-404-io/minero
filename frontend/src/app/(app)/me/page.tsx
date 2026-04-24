import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import { getPlanConfig } from "@/lib/mining";
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

export default async function MePage() {
  const [me, lastClaimData] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<LastClaimResp>("/claim/last"),
  ]);
  if (!me) redirect("/login");

  const plan = getPlanConfig(me.user.plan);

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
      planLabel={plan.label}
      lastClaimAt={lastClaimData?.lastClaimAt ?? null}
    />
  );
}
