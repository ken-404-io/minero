"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconPickaxe,
  IconChart,
  IconSparkles,
  IconUsers,
  IconWallet,
  IconShield,
  IconLogout,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactNode;
  shortcut?: string;
};

const PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Mine",     Icon: IconPickaxe, shortcut: "g d" },
  { href: "/earnings",  label: "Earnings", Icon: IconChart,   shortcut: "g e" },
  { href: "/plans",     label: "Plans",    Icon: IconSparkles,shortcut: "g p" },
  { href: "/referral",  label: "Invite",   Icon: IconUsers,   shortcut: "g r" },
  { href: "/withdraw",  label: "Cash Out", Icon: IconWallet,  shortcut: "g w" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashNav({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  }

  const initial = (name?.trim()?.[0] ?? "U").toUpperCase();

  return (
    <>
      {/* ===================== Mobile: top bar (brand only, no hamburger) ===================== */}
      <header className="mobile-topbar" role="banner">
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="Minero home">
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-md"
            style={{ background: "var(--brand-weak)", color: "var(--brand)", width: 32, height: 32 }}
          >
            <IconPickaxe size={18} />
          </span>
          <span className="font-semibold tracking-tight">Minero</span>
        </Link>
        <button
          onClick={logout}
          aria-label="Sign out"
          className="btn-icon"
        >
          <IconLogout size={18} />
        </button>
      </header>

      {/* ===================== Desktop: persistent side nav ===================== */}
      <aside className="side-nav" aria-label="Primary">
        <div className="h-16 flex items-center gap-2 px-5 border-b" style={{ borderColor: "var(--border)" }}>
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)", width: 36, height: 36 }}
          >
            <IconPickaxe size={20} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">Minero</span>
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>by Halvex</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4" aria-label="Main">
          <div className="section-title px-3 pb-2">Earn</div>
          {PRIMARY.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="side-nav-item"
              >
                <l.Icon size={18} />
                <span className="flex-1">{l.label}</span>
                {l.shortcut && (
                  <span className="hidden xl:inline-flex gap-1" aria-hidden>
                    {l.shortcut.split(" ").map((k, i) => (
                      <kbd key={i}>{k}</kbd>
                    ))}
                  </span>
                )}
              </Link>
            );
          })}

          {role === "admin" && (
            <>
              <div className="section-title px-3 pb-2 pt-4">Admin</div>
              <Link
                href="/admin"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className="side-nav-item"
              >
                <IconShield size={18} />
                <span>Admin console</span>
              </Link>
            </>
          )}
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
              {role === "admin" ? "Administrator" : "Member"}
            </div>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="btn-icon"
            title="Sign out"
          >
            <IconLogout size={18} />
          </button>
        </div>
      </aside>

      {/* ===================== Mobile: bottom tab bar ===================== */}
      <nav className="mobile-nav lg:hidden" aria-label="Primary">
        {PRIMARY.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              aria-label={l.label}
              className="mobile-nav-item"
            >
              <span className="mobile-nav-dot" aria-hidden />
              <l.Icon size={22} />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
