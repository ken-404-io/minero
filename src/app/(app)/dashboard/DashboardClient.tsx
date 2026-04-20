"use client";

import { useState } from "react";
import Link from "next/link";
import ClaimButton from "@/frontend/components/ClaimButton";
import { PLANS } from "@/backend/lib/mining";

type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };

type Props = {
  user: { id: string; name: string; balance: number; pendingBalance: number; plan: string; referralCode: string };
  plan: PlanConfig;
  lastClaimAt: Date | null;
  dailyEarned: number;
  referralCount: number;
};

export default function DashboardClient({ user, plan, lastClaimAt, dailyEarned, referralCount }: Props) {
  const [balance, setBalance] = useState(user.balance);
  const [todayEarned, setTodayEarned] = useState(dailyEarned);
  const [lastClaim, setLastClaim] = useState<Date | null>(lastClaimAt);

  function handleClaim(amount: number, nextClaimAt: Date) {
    setBalance((b) => parseFloat((b + amount).toFixed(4)));
    setTodayEarned((t) => parseFloat((t + amount).toFixed(4)));
    const prev = new Date(nextClaimAt.getTime() - 10 * 60 * 1000);
    setLastClaim(prev);
  }

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${user.referralCode}`;

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-1">Welcome back, {user.name.split(" ")[0]}</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        Plan: <span className="font-semibold" style={{ color: "var(--gold)" }}>{plan.label}</span>
        {" · "}Rate: ₱{plan.ratePerClaim}/claim
        {" · "}Daily cap: ₱{plan.dailyCap}
      </p>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="card">
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Available Balance</div>
          <div className="text-3xl font-extrabold" style={{ color: "var(--gold)" }}>
            ₱{balance.toFixed(2)}
          </div>
          {balance >= 300 && (
            <Link href="/withdraw" className="text-xs font-semibold mt-2 inline-block hover:underline" style={{ color: "#34d399" }}>
              Withdraw now →
            </Link>
          )}
        </div>
        <div className="card">
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Pending Balance</div>
          <div className="text-3xl font-extrabold" style={{ color: "var(--muted)" }}>
            ₱{user.pendingBalance.toFixed(2)}
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>Referral commissions (24–72h)</div>
        </div>
      </div>

      {/* Claim section */}
      <div className="card flex flex-col items-center py-10 mb-8">
        <h2 className="text-lg font-bold mb-6">Claim Your Reward</h2>
        <ClaimButton
          lastClaimAt={lastClaim}
          dailyEarned={todayEarned}
          dailyCap={plan.dailyCap}
          ratePerClaim={plan.ratePerClaim}
          onClaim={handleClaim}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>₱{todayEarned.toFixed(4)}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Earned Today</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold">{referralCount}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Referrals</div>
        </div>
        <div className="card text-center col-span-2 md:col-span-1">
          <div className="text-sm font-mono font-bold truncate" style={{ color: "var(--gold)" }}>
            {user.referralCode}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Referral Code</div>
          <button
            onClick={() => navigator.clipboard.writeText(referralLink)}
            className="text-xs mt-2 hover:underline"
            style={{ color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}
          >
            Copy link
          </button>
        </div>
      </div>

      {/* Upgrade CTA */}
      {user.plan === "free" && (
        <div className="card flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-bold">Earn up to 9× more</div>
            <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              Upgrade to ₱799 plan for ₱0.045/claim and ₱8 daily cap
            </div>
          </div>
          <Link href="/plans" className="btn-primary text-sm px-4 py-2 shrink-0">
            View Plans
          </Link>
        </div>
      )}
    </div>
  );
}
