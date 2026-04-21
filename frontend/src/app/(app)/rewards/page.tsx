import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import RewardsClient from "./RewardsClient";

type Me = {
  user: { id: string; name: string };
};

export default async function RewardsPage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return <RewardsClient playerName={me.user.name} />;
}
