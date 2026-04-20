import { getSession } from "@/backend/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminLogout from "./AdminLogout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 shrink-0 flex flex-col"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <div className="h-16 flex items-center px-6 text-xl font-bold" style={{ color: "var(--gold)" }}>
          🛡 Admin
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
          {[
            { href: "/admin", label: "Dashboard", icon: "📊" },
            { href: "/admin/users", label: "Users", icon: "👥" },
            { href: "/admin/withdrawals", label: "Withdrawals", icon: "💸" },
            { href: "/dashboard", label: "← User View", icon: "⛏" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "var(--muted)" }}
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <AdminLogout />
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-auto">{children}</main>
    </div>
  );
}
