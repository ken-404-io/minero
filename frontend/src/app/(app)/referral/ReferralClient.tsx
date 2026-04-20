"use client";

import { useEffect, useState } from "react";
import {
  IconCopy,
  IconCheck,
  IconShare,
  IconUsers,
  IconGift,
} from "@/components/icons";

type Referral = {
  id: string;
  commissionTotal: number;
  createdAt: string | Date;
  referred: { name: string; plan: string; createdAt: string | Date };
};

type Commission = {
  id: string;
  amount: number;
  status: string;
  createdAt: string | Date;
};

type Props = {
  referralCode: string;
  referrals: Referral[];
  commissions: Commission[];
  totalApproved: number;
  pendingCommission: number;
};

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReferralClient({
  referralCode,
  referrals,
  commissions,
  totalApproved,
  pendingCommission,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [referralLink, setReferralLink] = useState(`/register?ref=${referralCode}`);
  useEffect(() => {
    setReferralLink(`${window.location.origin}/register?ref=${referralCode}`);
  }, [referralCode]);

  function copyLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "Join me on Minero",
          text: "Earn real pesos every 10 minutes. Use my code.",
          url: referralLink,
        });
      } catch { /* cancelled */ }
    } else {
      copyLink();
    }
  }

  const empty = referrals.length === 0;

  return (
    <div className="w-full">
      {/* ============================================================
         DESKTOP (≥1024) — 2-column: invite/KPI panel + referrals list
         ============================================================ */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <header className="mb-8">
            <span className="section-title">Grow</span>
            <h1 className="text-3xl font-bold tracking-tight mt-1">Referral program</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              10% of every mining reward your referrals earn — forever.
            </p>
          </header>

          <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-6">
            {/* Sticky invite panel */}
            <aside className="flex flex-col gap-4">
              <section className="card" style={{ background: "var(--bg-elevated)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                    style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
                  >
                    <IconShare size={16} />
                  </span>
                  <span className="section-title">Your link</span>
                </div>
                <div className="surface-2 p-3 mb-3">
                  <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Code</div>
                  <div
                    className="font-mono font-semibold text-lg"
                    style={{ color: "var(--brand)" }}
                  >
                    {referralCode}
                  </div>
                </div>
                <label htmlFor="referral-link" className="input-label">
                  Shareable link
                </label>
                <input
                  id="referral-link"
                  readOnly
                  value={referralLink}
                  className="input font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={copyLink} className="btn btn-primary flex-1">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <button onClick={share} className="btn btn-secondary" aria-label="Share link">
                    <IconShare size={16} />
                  </button>
                </div>
              </section>

              <div className="grid grid-cols-3 gap-3">
                <div className="kpi">
                  <span className="kpi-label">Referrals</span>
                  <span className="kpi-value kpi-value-brand">{referrals.length}</span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Earned</span>
                  <span className="kpi-value" style={{ color: "var(--success-fg)" }}>
                    ₱{totalApproved.toFixed(2)}
                  </span>
                </div>
                <div className="kpi">
                  <span className="kpi-label">Pending</span>
                  <span className="kpi-value" style={{ color: "var(--text-muted)" }}>
                    ₱{pendingCommission.toFixed(2)}
                  </span>
                </div>
              </div>

              <section className="card">
                <div className="section-title mb-3">How it works</div>
                <ol className="space-y-3 text-sm">
                  {[
                    "Share your link or code.",
                    "They register and start mining.",
                    "You earn 10% of each approved claim.",
                    "Commissions clear in 24–72h.",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                        style={{ background: "var(--brand-weak)", color: "var(--brand-weak-fg)" }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>

            {/* Main list */}
            <section className="flex flex-col gap-6">
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  className="px-6 py-4 border-b flex items-center justify-between"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h2 className="font-semibold">Your referrals ({referrals.length})</h2>
                </div>

                {empty ? (
                  <EmptyReferrals />
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Plan</th>
                        <th>Joined</th>
                        <th className="text-right">Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium">{r.referred.name}</td>
                          <td><span className={`badge badge-${r.referred.plan}`}>{r.referred.plan}</span></td>
                          <td style={{ color: "var(--text-muted)" }} className="text-xs">
                            {fmtDate(r.createdAt)}
                          </td>
                          <td
                            className="text-right font-mono font-semibold tabular-nums"
                            style={{ color: "var(--brand)" }}
                          >
                            ₱{r.commissionTotal.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {commissions.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div
                    className="px-6 py-4 border-b"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <h2 className="font-semibold">Recent commissions</h2>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c) => (
                        <tr key={c.id}>
                          <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                          <td
                            className="text-right font-mono font-semibold tabular-nums"
                            style={{ color: "var(--brand)" }}
                          >
                            +₱{c.amount.toFixed(4)}
                          </td>
                          <td className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
                            {fmtDate(c.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* ============================================================
         MOBILE (<1024) — card stack
         ============================================================ */}
      <div className="lg:hidden">
        <div className="px-4 pt-4 pb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Invite</h1>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Earn 10% forever
          </p>

          {/* KPI chips */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="kpi" style={{ padding: "0.75rem" }}>
              <span className="kpi-label">Invited</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)" }}>
                {referrals.length}
              </span>
            </div>
            <div className="kpi" style={{ padding: "0.75rem" }}>
              <span className="kpi-label">Earned</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)", color: "var(--success-fg)" }}>
                ₱{totalApproved.toFixed(2)}
              </span>
            </div>
            <div className="kpi" style={{ padding: "0.75rem" }}>
              <span className="kpi-label">Pending</span>
              <span className="kpi-value" style={{ fontSize: "var(--fs-18)", color: "var(--text-muted)" }}>
                ₱{pendingCommission.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Primary action — share */}
          <section className="card mb-4" style={{ background: "var(--bg-elevated)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
              >
                <IconGift size={16} />
              </span>
              <div>
                <div className="font-semibold">Your code</div>
                <div
                  className="font-mono font-bold text-lg"
                  style={{ color: "var(--brand)" }}
                >
                  {referralCode}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={share} className="btn btn-primary flex-1">
                <IconShare size={16} /> Share link
              </button>
              <button onClick={copyLink} className="btn btn-secondary" aria-label="Copy link">
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </button>
            </div>
          </section>

          {/* Referrals list */}
          <section className="mb-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="font-semibold">Your referrals</h2>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {referrals.length}
              </span>
            </div>
            {empty ? (
              <EmptyReferrals />
            ) : (
              <ul className="flex flex-col gap-2">
                {referrals.map((r) => (
                  <li
                    key={r.id}
                    className="surface p-3 flex items-center gap-3"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full font-semibold"
                      style={{ background: "var(--surface-2)", color: "var(--text)" }}
                    >
                      {r.referred.name[0]?.toUpperCase() ?? "U"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.referred.name}
                      </div>
                      <div
                        className="text-xs flex items-center gap-1.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className={`badge badge-${r.referred.plan}`} style={{ padding: "0 6px" }}>
                          {r.referred.plan}
                        </span>
                        <span>{fmtDate(r.createdAt)}</span>
                      </div>
                    </div>
                    <div
                      className="text-sm font-mono font-semibold tabular-nums"
                      style={{ color: "var(--brand)" }}
                    >
                      ₱{r.commissionTotal.toFixed(2)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {commissions.length > 0 && (
            <section>
              <h2 className="font-semibold mb-2 px-1">Recent commissions</h2>
              <ul className="flex flex-col gap-2">
                {commissions.map((c) => (
                  <li
                    key={c.id}
                    className="surface p-3 flex items-center justify-between"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  >
                    <div>
                      <span className={`badge badge-${c.status}`}>{c.status}</span>
                      <div
                        className="text-xs mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {fmtDate(c.createdAt)}
                      </div>
                    </div>
                    <div
                      className="font-mono text-sm font-semibold tabular-nums"
                      style={{ color: "var(--brand)" }}
                    >
                      +₱{c.amount.toFixed(4)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyReferrals() {
  return (
    <div className="py-10 px-6 text-center">
      <div
        aria-hidden
        className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-3"
        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
      >
        <IconUsers size={22} />
      </div>
      <h3 className="font-semibold mb-1">No referrals yet</h3>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Share your link to start earning 10% commission.
      </p>
    </div>
  );
}
