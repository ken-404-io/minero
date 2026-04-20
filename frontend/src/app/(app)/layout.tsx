import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import DashNav from "@/components/DashNav";

type Me = { user: { id: string; name: string; role: string } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return (
    <div className="min-h-screen lg:flex">
      <DashNav name={me.user.name} role={me.user.role} />
      <main
        id="main"
        className="flex-1 flex flex-col min-w-0 has-mobile-nav"
        role="main"
      >
        {children}
      </main>
    </div>
  );
}
