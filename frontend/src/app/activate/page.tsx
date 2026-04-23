import { redirect } from "next/navigation";
import Link from "next/link";
import { apiJson } from "@/lib/api";
import ActivateClient from "./ActivateClient";
import { IconCheck } from "@/components/icons";

type Me = { user: { id: string; name: string; plan: string; role: string } };

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  if (me.user.plan === "paid" || me.user.role === "admin") {
    return (
      <div className="mx-auto max-w-xl px-4 lg:px-8 py-10">
        <header className="mb-6">
          <span className="section-title">Remove Ads</span>
          <h1 className="text-3xl font-bold tracking-tight mt-1">
            You&apos;re already ad-free!
          </h1>
        </header>
        <div className="card flex items-start gap-3" style={{ padding: "1.25rem" }}>
          <IconCheck size={20} style={{ color: "var(--success-fg)", marginTop: 2 }} className="shrink-0" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Your account has the ad-free plan. No ads will be shown to you.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-secondary mt-4 inline-flex">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const cancelled = sp.cancelled === "1";

  return <ActivateClient userName={me.user.name} cancelled={cancelled} />;
}
