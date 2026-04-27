"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ClaimButton from "@/components/ClaimButton";
import {
  IconArrowRight,
  IconCopy,
  IconCheck,
  IconUsers,
  IconWallet,
  IconShare,
  IconTrend,
} from "@/components/icons";
type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };

type Props = {
  user: {
    id: string;
    name: string;
    balance: number;
    pendingBalance: number;
    plan: string;
    referralCode: string;
    streakCount: number;
  };
  plan: PlanConfig;
  claimIntervalMs: number;
  lastClaimAt: string | Date | null;
  dailyEarned: number;
  referralCount: number;
};

export default function DashboardClient({
  user,
  plan,
  claimIntervalMs,
  lastClaimAt,
  dailyEarned,
  referralCount,
}: Props) {
  const [balance, setBalance] = useState(user.balance);
  const [todayEarned, setTodayEarned] = useState(dailyEarned);
  const [lastClaim, setLastClaim] = useState<Date | null>(
    lastClaimAt ? new Date(lastClaimAt) : null
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function update() {
      if (!lastClaim) {
        document.title = "⛏️ Ready to mine! — Minero";
        return;
      }
      const remaining = Math.max(0, claimIntervalMs - (Date.now() - lastClaim.getTime()));
      if (remaining === 0) {
        document.title = "⛏️ Ready to mine! — Minero";
      } else {
        const m = Math.floor(remaining / 60000).toString().padStart(2, "0");
        const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, "0");
        document.title = `⛏️ ${m}:${s} — Minero`;
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => {
      clearInterval(id);
      document.title = "Minero";
    };
  }, [lastClaim]);

  function handleClaim(amount: number, nextClaimAt: Date) {
    setBalance((b) => parseFloat((b + amount).toFixed(4)));
    setTodayEarned((t) => parseFloat((t + amount).toFixed(4)));
    const prev = new Date(nextClaimAt.getTime() - claimIntervalMs);
    setLastClaim(prev);
  }

  const referralLink = `${
    typeof window !== "undefined" ? window.location.origin : ""
  }/register?ref=${user.referralCode}`;

  function copy() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const firstName = user.name.split(" ")[0];
  const balanceReady = balance >= 300;

  return (
    <div className="w-full">
      {/* =============================================================
         DESKTOP LAYOUT (≥1024px) — split view: claim + inspector rail
         ============================================================= */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <header className="mb-8 flex items-end justify-between gap-4">
            <div>
              <span className="section-title">Dashboard</span>
              <h1 className="text-3xl font-bold tracking-tight mt-1">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm mt-1 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                {plan.label} · ₱{plan.ratePerClaim}/claim · ₱{plan.dailyCap} daily cap
                {user.streakCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ background: "var(--warning-weak)", color: "var(--warning-fg)" }}
                  >
                    🔥 {user.streakCount}-day streak
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/earnings" className="btn btn-secondary btn-sm">
                <IconTrend size={16} /> View earnings
              </Link>
              <Link
                href="/withdraw"
                className={`btn btn-sm ${balanceReady ? "btn-primary" : "btn-secondary"}`}
                aria-disabled={!balanceReady}
              >
                <IconWallet size={16} /> Withdraw
              </Link>
            </div>
          </header>

          <div className="grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-6">
            {/* LEFT: claim + KPIs */}
            <div className="flex flex-col gap-6 min-w-0">
              <section className="card" style={{ background: "var(--bg-elevated)" }}>
                <div className="flex flex-col items-center gap-6 py-6">
                  <div className="text-center">
                    <span className="section-title">Claim reward</span>
                    <h2 className="text-xl font-semibold mt-1">Every {Math.round(claimIntervalMs / 60000)} minutes</h2>
                  </div>
                  <ClaimButton
                    lastClaimAt={lastClaim}
                    dailyEarned={todayEarned}
                    dailyCap={plan.dailyCap}
                    ratePerClaim={plan.ratePerClaim}
                    claimIntervalMs={claimIntervalMs}
                    onClaim={handleClaim}
                  />
                </div>
              </section>

              <section className="grid grid-cols-3 gap-4">
                <div className="kpi">
                  <span className="kpi-label">Available balance</span>
                  <span className="kpi-value kpi-value-brand">₱{balance.toFixed(2)}</span>
                  {balanceReady && (
                    <Link
                      href="/withdraw"
                      className="kpi-delta link-brand inline-flex items-center gap-1"
                    >
                      Withdraw <IconArrowRight size={12} />
                    </Link>
                  )}
                </div>
                <div className="kpi">
                  <span className="kpi-label">Pending commissions</span>
                  <span className="kpi-value" style={{ color: "var(--text-muted)" }}>
                    ₱{user.pendingBalance.toFixed(2)}
                  </span>
                  <span className="kpi-delta">Clears in 24–72h</span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Earned today</span>
                  <span className="kpi-value">₱{todayEarned.toFixed(4)}</span>
                  <span className="kpi-delta">
                    ₱{plan.dailyCap.toFixed(2)} daily cap
                  </span>
                </div>
              </section>
            </div>

            {/* RIGHT: inspector — referral + upgrade */}
            <aside className="flex flex-col gap-6">
              <section className="card" style={{ background: "var(--bg-elevated)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="section-title">Your referral</span>
                  <span className="badge badge-approved">
                    <IconUsers size={12} /> {referralCount}
                  </span>
                </div>
                <div className="surface-2 p-3 flex items-center justify-between">
                  <span className="font-mono font-semibold" style={{ color: "var(--brand)" }}>
                    {user.referralCode}
                  </span>
                  <button
                    onClick={copy}
                    className="btn btn-sm btn-ghost"
                    aria-label="Copy referral link"
                  >
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                  Earn 10% of every reward your referrals claim — automatically, forever.
                </p>
                <Link
                  href="/referral"
                  className="mt-4 btn btn-secondary w-full btn-sm"
                >
                  <IconShare size={16} /> Manage referrals
                </Link>
              </section>

            </aside>
          </div>
        </div>
      </div>

      {/* =============================================================
         MOBILE LAYOUT (<1024px) — thumb-first, claim dominates
         ============================================================= */}
      <div className="lg:hidden">
        <div className="px-4 pt-4 pb-6">
          {/* Greeting + balance hero */}
          <section className="mb-6">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Hi, {firstName}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums" style={{ color: "var(--brand)" }}>
                ₱{balance.toFixed(2)}
              </span>
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                available
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Pending ₱{user.pendingBalance.toFixed(2)}</span>
              <span aria-hidden>·</span>
              <span>{plan.label}</span>
              {user.streakCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span style={{ color: "var(--warning-fg)" }}>🔥 {user.streakCount}d streak</span>
                </>
              )}
            </div>
          </section>

          {/* Claim section — hero */}
          <section
            className="card mb-6"
            style={{ background: "var(--bg-elevated)", padding: "1.25rem 1rem 1.5rem" }}
          >
            <div className="text-center mb-4">
              <span className="section-title">Claim reward</span>
            </div>
            <ClaimButton
              lastClaimAt={lastClaim}
              dailyEarned={todayEarned}
              dailyCap={plan.dailyCap}
              ratePerClaim={plan.ratePerClaim}
              claimIntervalMs={claimIntervalMs}
              onClaim={handleClaim}
            />
          </section>

          {/* Quick stats */}
          <section className="grid grid-cols-2 gap-3 mb-6">
            <div className="kpi" style={{ padding: "0.875rem" }}>
              <span className="kpi-label">Today</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)" }}>
                ₱{todayEarned.toFixed(4)}
              </span>
            </div>
            <div className="kpi" style={{ padding: "0.875rem" }}>
              <span className="kpi-label">Referrals</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)" }}>
                {referralCount}
              </span>
            </div>
          </section>

          {/* Referral card */}
          <section className="card mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
                >
                  <IconShare size={16} />
                </span>
                <span className="font-semibold">Invite friends</span>
              </div>
              <Link href="/referral" className="link-brand text-sm inline-flex items-center gap-1">
                Manage <IconArrowRight size={12} />
              </Link>
            </div>
            <div className="surface-2 p-3 flex items-center justify-between">
              <span className="font-mono text-sm font-semibold" style={{ color: "var(--brand)" }}>
                {user.referralCode}
              </span>
              <button
                onClick={copy}
                className="btn btn-sm btn-primary"
                aria-label="Copy referral link"
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
