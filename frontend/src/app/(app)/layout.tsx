import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import DashNav from "@/components/DashNav";

type Me = { user: { id: string; name: string; role: string } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <DashNav name={me.user.name} role={me.user.role} />
      <main className="flex-1 flex flex-col overflow-auto">{children}</main>
    </div>
  );
}
