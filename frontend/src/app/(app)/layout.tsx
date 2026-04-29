import { redirect } from "next/navigation";
import { apiJson, serverApiUrl } from "@/lib/api";
import DashNav from "@/components/DashNav";
import AdBanner from "@/components/AdBanner";
import Heartbeat from "@/components/Heartbeat";

type Me = { user: { id: string; name: string; role: string; plan: string } };

async function isMaintenance(): Promise<boolean> {
  try {
    const res = await fetch(`${serverApiUrl()}/config/public`, { next: { revalidate: 60 } });
    if (!res.ok) return false;
    const data = await res.json() as { maintenanceMode?: boolean };
    return data.maintenanceMode === true;
  } catch {
    return false;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  if (me.user.role !== "admin" && await isMaintenance()) {
    redirect("/maintenance");
  }

  const adFree = me.user.plan === "paid" || me.user.role === "admin";

  return (
    <div className="min-h-screen lg:flex">
      <Heartbeat />
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
