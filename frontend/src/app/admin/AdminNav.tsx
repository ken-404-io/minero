"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconShield,
  IconChart,
  IconUsers,
  IconWallet,
  IconPickaxe,
  IconLogout,
} from "@/components/icons";

const LINKS = [
  { href: "/admin",             label: "Overview",    Icon: IconChart },
  { href: "/admin/users",       label: "Users",       Icon: IconUsers },
  { href: "/admin/withdrawals", label: "Withdrawals", Icon: IconWallet },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = (name?.trim()?.[0] ?? "A").toUpperCase();

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="mobile-topbar" role="banner">
        <Link href="/admin" className="flex items-center gap-2" aria-label="Admin">
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-md"
            style={{ background: "var(--brand-weak)", color: "var(--brand)", width: 32, height: 32 }}
          >
            <IconShield size={18} />
          </span>
          <span className="font-semibold tracking-tight">Admin</span>
        </Link>
        <button onClick={logout} aria-label="Sign out" className="btn-icon">
          <IconLogout size={18} />
        </button>
      </header>

      {/* Desktop side nav */}
      <aside className="side-nav" aria-label="Admin">
        <div className="h-16 flex items-center gap-2 px-5 border-b" style={{ borderColor: "var(--border)" }}>
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)", width: 36, height: 36 }}
          >
            <IconShield size={20} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">Admin console</span>
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>Minero</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4" aria-label="Admin primary">
          <div className="section-title px-3 pb-2">Manage</div>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(pathname, l.href) ? "page" : undefined}
              className="side-nav-item"
            >
              <l.Icon size={18} />
              <span className="flex-1">{l.label}</span>
            </Link>
          ))}

          <div className="section-title px-3 pb-2 pt-4">Personal</div>
          <Link href="/dashboard" className="side-nav-item">
            <IconPickaxe size={18} />
            <span>Switch to user</span>
          </Link>
        </nav>

        <div className="p-3 border-t flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div
            aria-hidden
            className="inline-flex items-center justify-center rounded-full font-semibold"
            style={{ background: "var(--surface-2)", color: "var(--text)", width: 36, height: 36 }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{name}</div>
            <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
              Administrator
            </div>
          </div>
          <button onClick={logout} aria-label="Sign out" className="btn-icon" title="Sign out">
            <IconLogout size={18} />
          </button>
        </div>
      </aside>

      {/* Mobile bottom tabs */}
      <nav className="mobile-nav lg:hidden" aria-label="Admin primary">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            aria-label={l.label}
            className="mobile-nav-item"
          >
            <span className="mobile-nav-dot" aria-hidden />
            <l.Icon size={22} />
            <span>{l.label}</span>
          </Link>
        ))}
        <Link
          href="/dashboard"
          aria-label="Switch to user"
          className="mobile-nav-item"
        >
          <span className="mobile-nav-dot" aria-hidden />
          <IconPickaxe size={22} />
          <span>User</span>
        </Link>
      </nav>
    </>
  );
}
