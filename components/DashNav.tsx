"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "⛏" },
  { href: "/earnings", label: "Earnings", icon: "📊" },
  { href: "/plans", label: "Plans", icon: "💎" },
  { href: "/referral", label: "Referral", icon: "🤝" },
  { href: "/withdraw", label: "Withdraw", icon: "💸" },
];

export default function DashNav({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-56 shrink-0 min-h-screen"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
      >
        <div className="h-16 flex items-center px-6 text-xl font-bold" style={{ color: "var(--gold)" }}>
          ⛏ Minero
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={
                pathname === l.href
                  ? { background: "#2d2000", color: "var(--gold)" }
                  : { color: "var(--muted)" }
              }
            >
              <span>{l.icon}</span>
              {l.label}
            </Link>
          ))}
          {role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={pathname.startsWith("/admin") ? { background: "#2d2000", color: "var(--gold)" } : { color: "var(--muted)" }}
            >
              <span>🛡</span>
              Admin
            </Link>
          )}
        </nav>
        <div className="px-3 pb-4">
          <div className="px-3 py-2 text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
            {name}
          </div>
          <button
            onClick={logout}
            className="btn-secondary w-full text-sm py-2"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header
        className="md:hidden flex items-center justify-between h-14 px-4 border-b sticky top-0 z-30"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <span className="font-bold" style={{ color: "var(--gold)" }}>⛏ Minero</span>
        <button onClick={() => setOpen(!open)} className="text-xl">☰</button>
      </header>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 flex"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-64 min-h-full flex flex-col shadow-xl"
            style={{ background: "var(--surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 flex items-center px-6 text-xl font-bold" style={{ color: "var(--gold)" }}>
              ⛏ Minero
            </div>
            <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                  style={
                    pathname === l.href
                      ? { background: "#2d2000", color: "var(--gold)" }
                      : { color: "var(--muted)" }
                  }
                >
                  <span>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
              {role === "admin" && (
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: "var(--muted)" }}>
                  <span>🛡</span> Admin
                </Link>
              )}
            </nav>
            <div className="px-3 pb-4">
              <button onClick={logout} className="btn-secondary w-full text-sm py-2">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
