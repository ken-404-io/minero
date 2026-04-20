"use client";

import { useState } from "react";

type Referral = {
  id: string;
  commissionTotal: number;
  createdAt: Date;
  referred: { name: string; plan: string; createdAt: Date };
};

type Commission = {
  id: string;
  amount: number;
  status: string;
  createdAt: Date;
};

type Props = {
  referralCode: string;
  referrals: Referral[];
  commissions: Commission[];
  totalApproved: number;
  pendingCommission: number;
};

export default function ReferralClient({ referralCode, referrals, commissions, totalApproved, pendingCommission }: Props) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = `${origin}/register?ref=${referralCode}`;

  function copyLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">Referral Program</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>{referrals.length}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Total Referrals</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: "#34d399" }}>₱{totalApproved.toFixed(4)}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Total Earned</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold" style={{ color: "var(--muted)" }}>₱{pendingCommission.toFixed(4)}</div>
          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Pending</div>
        </div>
      </div>

      {/* Referral link */}
      <div className="card mb-8">
        <h2 className="font-bold mb-2">Your Referral Link</h2>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          Share this link to earn 10% of every reward your referrals mine — automatically, forever.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={referralLink}
            className="input flex-1 text-sm font-mono"
          />
          <button onClick={copyLink} className="btn-primary px-4 shrink-0 text-sm">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-3 text-sm">
          Code: <span className="font-mono font-bold" style={{ color: "var(--gold)" }}>{referralCode}</span>
        </div>
      </div>

      {/* How it works */}
      <div className="card mb-8" style={{ background: "#0d1520" }}>
        <h2 className="font-bold mb-3">How It Works</h2>
        <ol className="text-sm space-y-2" style={{ color: "var(--muted)" }}>
          <li>1. Share your referral link or code with friends.</li>
          <li>2. When they register and start mining, you automatically earn 10% of each claim.</li>
          <li>3. Commissions go to <strong>Pending</strong> for 24–72 hours (fraud review).</li>
          <li>4. Once approved, they move to your <strong>Available Balance</strong> and can be withdrawn.</li>
        </ol>
      </div>

      {/* Referrals list */}
      <div className="card mb-8">
        <h2 className="font-bold mb-4">Your Referrals ({referrals.length})</h2>
        {referrals.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>
            No referrals yet. Share your link to start earning!
          </p>
        ) : (
          <div className="space-y-2">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="text-sm font-medium">{r.referred.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    Joined {new Date(r.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}{r.referred.plan === "free" ? "Free plan" : r.referred.plan}
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: "var(--gold)" }}>
                  ₱{r.commissionTotal.toFixed(4)} earned
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent commissions */}
      {commissions.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-4">Recent Commissions</h2>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-1 font-medium" style={{ color: "var(--muted)" }}>Amount</th>
                <th className="text-center py-1 font-medium" style={{ color: "var(--muted)" }}>Status</th>
                <th className="text-right py-1 font-medium" style={{ color: "var(--muted)" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 font-mono font-bold" style={{ color: "var(--gold)" }}>+₱{c.amount.toFixed(4)}</td>
                  <td className="py-2 text-center">
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                  </td>
                  <td className="py-2 text-right text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(c.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
