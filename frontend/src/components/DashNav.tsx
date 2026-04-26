"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api-url";
import { getGameBalance, GAME_BALANCE_CHANGED } from "@/lib/game-session";
import {
  IconPickaxe,
  IconChart,
  IconUsers,
  IconWallet,
  IconShield,
  IconLogout,
  IconGame,
  IconGift,
  IconUser,
  IconSparkles,
  IconTrophy,
  IconBell,
  IconDiamond,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  Icon: (p: { size?: number }) => React.ReactNode;
  shortcut?: string;
};

const PRIMARY: NavItem[] = [
  { href: "/dashboard",   label: "Mine",        Icon: IconPickaxe, shortcut: "g d" },
  { href: "/earnings",    label: "Earnings",    shortLabel: "Earn",  Icon: IconChart,   shortcut: "g e" },
  { href: "/game",        label: "Game",        Icon: IconGame,    shortcut: "g g" },
  { href: "/rewards",     label: "Rewards",     shortLabel: "Reward", Icon: IconGift,  shortcut: "g x" },
  { href: "/referral",    label: "Invite",      Icon: IconUsers,   shortcut: "g r" },
  { href: "/withdraw",    label: "Cash Out",    shortLabel: "Cash",  Icon: IconWallet,  shortcut: "g w" },
  { href: "/leaderboard", label: "Leaderboard", shortLabel: "Ranks", Icon: IconTrophy,  shortcut: "g l" },
  { href: "/me",          label: "Me",          Icon: IconUser,    shortcut: "g m" },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Mine",   Icon: IconPickaxe },
  { href: "/earnings",  label: "Earn",   Icon: IconChart   },
  { href: "/game",      label: "Game",   Icon: IconGame    },
  { href: "/rewards",   label: "Reward", Icon: IconGift    },
  { href: "/me",        label: "Me",     Icon: IconUser    },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashNav({ name, role, plan }: { name: string; role: string; plan: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    async function fetchCoins() {
      const bal = await getGameBalance();
      if (bal !== null) setCoins(bal.balance);
    }
    fetchCoins();
    window.addEventListener(GAME_BALANCE_CHANGED, fetchCoins);
    return () => window.removeEventListener(GAME_BALANCE_CHANGED, fetchCoins);
  }, []);

  async function logout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/");
    router.refresh();
  }

  const initial = (name?.trim()?.[0] ?? "U").toUpperCase();

  return (
    <>
      {/* ===================== Mobile: top bar ===================== */}
      <header className="mobile-topbar" role="banner">
        {/* Amber gradient glow — top-right corner */}
        <span className="mobile-topbar-glow" aria-hidden />

        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2 relative z-10" aria-label="Minero home">
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)", width: 40, height: 40 }}
          >
            <IconPickaxe size={20} />
          </span>
          <span className="font-bold tracking-tight text-base">Minero</span>
        </Link>

        {/* Right controls */}
        <div className="flex items-center gap-2 relative z-10">
          <Link href="/game" className="mobile-topbar-coins" aria-label={`${coins} game coins`}>
            <IconDiamond size={14} style={{ color: "#60a5fa" }} />
            <span className="font-semibold tabular-nums">{coins.toLocaleString()}</span>
          </Link>
          <button className="mobile-topbar-bell" aria-label="Notifications">
            <IconBell size={20} />
            <span className="mobile-topbar-bell-dot" aria-hidden />
          </button>
        </div>
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

        {plan !== "paid" && role !== "admin" && (
          <div className="px-3 pb-3">
            <Link
              href="/activate"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
            >
              <IconSparkles size={16} />
              <span>Remove Ads</span>
            </Link>
          </div>
        )}

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
              {role === "admin" ? "Administrator" : plan === "paid" ? "Ad-Free" : "Member"}
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

      {/* ===================== Mobile: bottom tab bar — Curved Wave Nav ===================== */}
      <nav className="mobile-nav lg:hidden" aria-label="Primary">
        {/* Wave SVG background */}
        <svg
          aria-hidden
          className="mobile-nav-bg"
          viewBox="0 0 375 64"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Filled background — rounded top corners, smooth wave notch at center */}
          <path
            fill="var(--surface)"
            d="M20,0 L120,0 C147,0 165,28 187.5,28 C210,28 228,0 255,0 L355,0 Q375,0 375,20 L375,64 L0,64 L0,20 Q0,0 20,0 Z"
          />
          {/* Border — traces only the top edge (sides are screen-flush) */}
          <path
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
            d="M0,20 Q0,0 20,0 L120,0 C147,0 165,28 187.5,28 C210,28 228,0 255,0 L355,0 Q375,0 375,20"
          />
        </svg>

        <div className="mobile-nav-items">
          {/* Left two tabs */}
          {MOBILE_NAV.slice(0, 2).map((l) => {
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
                <span className="mobile-nav-label">{l.label}</span>
              </Link>
            );
          })}

          {/* Center elevated tab */}
          {(() => {
            const l = MOBILE_NAV[2];
            const active = isActive(pathname, l.href);
            return (
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                aria-label={l.label}
                className="mobile-nav-center"
              >
                <span className={`mobile-nav-center-btn${active ? " is-active" : ""}`} aria-hidden>
                  <l.Icon size={26} />
                </span>
                <span className="mobile-nav-label" style={{ color: active ? "var(--brand)" : "var(--text-muted)" }}>
                  {l.label}
                </span>
              </Link>
            );
          })()}

          {/* Right two tabs */}
          {MOBILE_NAV.slice(3).map((l) => {
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
                <span className="mobile-nav-label">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
