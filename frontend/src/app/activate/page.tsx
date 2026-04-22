import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import ActivateClient from "./ActivateClient";

type Me = { user: { id: string; name: string; plan: string; role: string } };

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.plan === "paid") redirect("/dashboard");

  const sp = await searchParams;
  const cancelled = sp.cancelled === "1";

  return <ActivateClient userName={me.user.name} cancelled={cancelled} />;
}
