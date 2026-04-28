"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api-url";
import AuthOverlay from "@/components/AuthOverlay";
import {
  IconChart,
  IconChevronRight,
  IconFileText,
  IconGift,
  IconInfo,
  IconLock,
  IconLogout,
  IconMail,
  IconShield,
  IconSparkles,
  IconUsers,
  IconWallet,
} from "@/components/icons";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  referralCode: string | null;
  createdAt: string;
};

type Props = {
  user: User;
  planLabel: string;
  claimIntervalMs: number;
  lastClaimAt: string | null;
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}••@${domain}`;
  return `${local.slice(0, 2)}${"•".repeat(Math.min(6, local.length - 2))}@${domain}`;
}

function formatJoined(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function MeClient({ user, planLabel, claimIntervalMs, lastClaimAt }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mineCountdown, setMineCountdown] = useState("");

  useEffect(() => {
    const lastClaim = lastClaimAt ? new Date(lastClaimAt) : null;
    function update() {
      if (!lastClaim) { setMineCountdown("Ready to mine!"); return; }
      const remaining = Math.max(0, claimIntervalMs - (Date.now() - lastClaim.getTime()));
      if (remaining === 0) {
        setMineCountdown("Ready to mine!");
      } else {
        const m = Math.floor(remaining / 60000).toString().padStart(2, "0");
        const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
        setMineCountdown(`Mine again in ${m}:${s}`);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastClaimAt]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      router.push("/");
      router.refresh();
      // Keep loggingOut=true so the overlay stays until navigation completes.
    } catch {
      setLoggingOut(false);
    }
  }

  const initial = (user.name?.trim()?.[0] ?? "U").toUpperCase();
  const isAdmin = user.role === "admin";

  return (
    <>
    {loggingOut && <AuthOverlay mode="out" />}
    <div className="flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ============================================================
         Brand-colored identity header
         ============================================================ */}
      <section
        className="px-4 pt-6 pb-8 lg:px-8 lg:pt-8"
        style={{
          background: "linear-gradient(180deg, var(--brand) 0%, var(--brand-pressed) 100%)",
          color: "var(--brand-fg)",
        }}
      >
        <div className="mx-auto max-w-[1280px] flex items-center gap-4">
          <div
            aria-hidden
            className="inline-flex items-center justify-center rounded-full font-bold shrink-0"
            style={{
              background: "var(--brand-fg)",
              color: "var(--brand)",
              width: 56,
              height: 56,
              fontSize: 22,
              border: "2px solid color-mix(in oklab, var(--brand-fg) 30%, transparent)",
            }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase truncate">
              {user.name || "Miner"}
            </h1>
            <div
              className="text-xs md:text-sm mt-0.5 truncate"
              style={{ color: "color-mix(in oklab, var(--brand-fg) 75%, transparent)" }}
            >
              {maskEmail(user.email)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: "color-mix(in oklab, var(--brand-fg) 20%, transparent)",
                  color: "var(--brand-fg)",
                }}
              >
                {planLabel}
              </span>
              <span
                className="text-[11px]"
                style={{ color: "color-mix(in oklab, var(--brand-fg) 65%, transparent)" }}
              >
                Member since {formatJoined(user.createdAt)}
              </span>
              {mineCountdown && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                  style={{
                    background: "color-mix(in oklab, var(--brand-fg) 20%, transparent)",
                    color: mineCountdown === "Ready to mine!" ? "var(--brand-fg)" : "color-mix(in oklab, var(--brand-fg) 80%, transparent)",
                  }}
                >
                  ⛏️ {mineCountdown}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
         Menu card
         ============================================================ */}
      <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 -mt-4">
        <div
          className="card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <MenuRow
            href="/earnings"
            icon={<IconChart size={20} />}
            label="Financial Overview"
            caption="Balance, claim history, payouts"
          />
          <MenuRow
            href="/withdraw"
            icon={<IconWallet size={20} />}
            label="Cash Out"
            caption="GCash · Maya"
          />
          <MenuRow
            href="/rewards"
            icon={<IconGift size={20} />}
            label="Rewards"
            caption="Redeem game coins"
          />
          <MenuRow
            href="/referral"
            icon={<IconUsers size={20} />}
            label="Refer & Earn"
            caption={user.referralCode ? `Code ${user.referralCode}` : "Invite friends"}
          />
          <MenuRow
            href="/achievements"
            icon={<IconSparkles size={20} />}
            label="Achievements"
            caption="Badges & milestones"
          />
          <MenuRow
            href="/me/security"
            icon={<IconLock size={20} />}
            label="Account Security"
            caption="Sessions · password"
          />
          <MenuRow
            href="/terms"
            icon={<IconFileText size={20} />}
            label="Terms of Service"
          />
          <MenuRow
            href="/privacy"
            icon={<IconShield size={20} />}
            label="Privacy Policy"
          />
          <MenuRow
            href="/disclaimer"
            icon={<IconInfo size={20} />}
            label="Disclaimer"
          />
          <MenuRow
            href="/contact"
            icon={<IconMail size={20} />}
            label="Contact Support"
            caption="Questions, disputes, data requests"
            isLast={!isAdmin}
          />
          {isAdmin && (
            <MenuRow
              href="/admin"
              icon={<IconShield size={20} />}
              label="Admin Console"
              caption="Internal tools"
              isLast
            />
          )}
        </div>

        {/* Log out */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold"
            style={{
              color: "var(--brand)",
              background: "transparent",
              border: "none",
              cursor: loggingOut ? "not-allowed" : "pointer",
              opacity: loggingOut ? 0.6 : 1,
            }}
          >
            <IconLogout size={18} />
            Log Out
          </button>
        </div>

        <p
          className="mt-4 mb-8 text-center text-[11px]"
          style={{ color: "var(--text-subtle)" }}
        >
          Minero by Strong Fund Inc · ID {user.id.slice(0, 8).toUpperCase()}
        </p>
      </section>
    </div>
    </>
  );
}

/* ============================================================
   Menu row
   ============================================================ */

function MenuRow({
  href,
  icon,
  label,
  caption,
  isLast = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  caption?: string;
  isLast?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        color: "var(--text)",
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center shrink-0 rounded-md"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-muted)",
          width: 36,
          height: 36,
        }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{label}</span>
        {caption && (
          <span
            className="block text-xs truncate"
            style={{ color: "var(--text-subtle)" }}
          >
            {caption}
          </span>
        )}
      </span>
      <IconChevronRight size={18} />
    </Link>
  );
}
