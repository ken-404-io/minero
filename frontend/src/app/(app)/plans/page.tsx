import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import { PLANS } from "@/lib/mining";
import PlansClient from "./PlansClient";

type Me = { user: { plan: string } };

export default async function PlansPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return <PlansClient currentPlan={me.user.plan} plans={PLANS} />;
}
