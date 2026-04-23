import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import DashNav from "@/components/DashNav";
import AdBanner from "@/components/AdBanner";

type Me = { user: { id: string; name: string; role: string; plan: string } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  const adFree = me.user.plan === "paid" || me.user.role === "admin";

  return (
    <div className="min-h-screen lg:flex">
      <DashNav name={me.user.name} role={me.user.role} plan={me.user.plan} />
      <main
        id="main"
        className="flex-1 flex flex-col min-w-0 has-mobile-nav"
        role="main"
      >
        {!adFree && <AdBanner />}
        {children}
      </main>
    </div>
  );
}
