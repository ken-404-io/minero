import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminNav from "./AdminNav";

type Me = { user: { id: string; name: string; role: string } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen lg:flex">
      <AdminNav name={me.user.name} />
      <main id="main" className="flex-1 flex flex-col min-w-0 has-mobile-nav" role="main">
        {children}
      </main>
    </div>
  );
}
