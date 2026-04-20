"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };
type Plans = Record<string, PlanConfig>;

type Props = {
  currentPlan: string;
  plans: Plans;
};

const planOrder = ["free", "plan499", "plan699", "plan799"];

export default function PlansClient({ currentPlan, plans }: Props) {
  const router = useRouter();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentIdx = planOrder.indexOf(currentPlan);

  async function handleUpgrade() {
    if (!selectedPlan || !paymentRef.trim()) return;
    setUpgrading(selectedPlan);
    setError("");
    try {
      const res = await fetch("/api/plans/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, paymentRef }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Successfully upgraded to ${data.label}!`);
        setSelectedPlan(null);
        setPaymentRef("");
        router.refresh();
      } else {
        setError(typeof data.error === "string" ? data.error : "Upgrade failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-2">Mining Plans</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        One-time upgrade. Non-refundable. Lifetime access.
      </p>

      {success && (
        <div className="mb-6 px-4 py-3 rounded-lg text-sm font-semibold" style={{ background: "#0a2e1a", color: "#34d399" }}>
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {planOrder.map((key) => {
          const plan = plans[key];
          const idx = planOrder.indexOf(key);
          const isCurrent = key === currentPlan;
          const canUpgrade = idx > currentIdx && key !== "free";

          return (
            <div
              key={key}
              className="card flex flex-col gap-4"
              style={
                isCurrent
                  ? { border: "2px solid var(--gold)" }
                  : selectedPlan === key
                  ? { border: "2px solid #60a5fa" }
                  : {}
              }
            >
              {isCurrent && (
                <div
                  className="text-xs font-bold text-center py-1 rounded-full"
                  style={{ background: "var(--gold)", color: "#000" }}
                >
                  CURRENT PLAN
                </div>
              )}
              <div className="font-bold text-lg">{plan.label}</div>
              <div className="text-3xl font-extrabold" style={{ color: "var(--gold)" }}>
                {plan.price === 0 ? "Free" : `₱${plan.price}`}
              </div>
              <ul className="text-sm space-y-2" style={{ color: "var(--muted)" }}>
                <li>✓ ₱{plan.ratePerClaim} per 10-min claim</li>
                <li>✓ ₱{plan.dailyCap} daily cap</li>
                <li>✓ {plan.price === 0 ? "No payment needed" : "One-time payment"}</li>
                <li>✓ Lifetime access</li>
              </ul>
              {canUpgrade && (
                <button
                  onClick={() => setSelectedPlan(key === selectedPlan ? null : key)}
                  className={selectedPlan === key ? "btn-secondary" : "btn-primary"}
                >
                  {selectedPlan === key ? "Cancel" : "Select Plan"}
                </button>
              )}
              {isCurrent && (
                <div className="text-xs text-center py-2" style={{ color: "var(--muted)" }}>Active</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment modal */}
      {selectedPlan && (
        <div className="card max-w-md mx-auto">
          <h2 className="font-bold text-lg mb-4">Complete Upgrade to {plans[selectedPlan].label}</h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Pay <strong style={{ color: "var(--gold)" }}>₱{plans[selectedPlan].price}</strong> via GCash or Maya to:
          </p>
          <div
            className="p-3 rounded-lg text-sm font-mono mb-4"
            style={{ background: "var(--surface-2)", color: "var(--gold)" }}
          >
            GCash / Maya: 09XX-XXX-XXXX<br />
            Name: Halvex Inc.
          </div>
          <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>Enter your GCash/Maya reference number:</p>
          <input
            className="input mb-3"
            type="text"
            placeholder="e.g. 1234567890"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />
          {error && (
            <div className="mb-3 text-sm" style={{ color: "#f87171" }}>{error}</div>
          )}
          <div className="flex gap-3">
            <button
              className="btn-primary flex-1"
              onClick={handleUpgrade}
              disabled={!!upgrading || !paymentRef.trim()}
            >
              {upgrading ? "Upgrading…" : "Confirm Upgrade"}
            </button>
            <button
              className="btn-secondary"
              onClick={() => { setSelectedPlan(null); setError(""); }}
            >
              Cancel
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Plan upgrades are non-refundable. Reference numbers are reviewed manually. Upgrade is applied within 24 hours.
          </p>
        </div>
      )}

      <div className="mt-8 card">
        <h3 className="font-bold mb-3">Plan Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 font-medium" style={{ color: "var(--muted)" }}>Feature</th>
                {planOrder.map((k) => (
                  <th key={k} className="text-center py-2 font-medium" style={{ color: k === currentPlan ? "var(--gold)" : "var(--muted)" }}>
                    {plans[k].label.replace(" Plan", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2" style={{ color: "var(--muted)" }}>Rate/claim</td>
                {planOrder.map((k) => (
                  <td key={k} className="py-2 text-center font-mono text-xs">₱{plans[k].ratePerClaim}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2" style={{ color: "var(--muted)" }}>Daily cap</td>
                {planOrder.map((k) => (
                  <td key={k} className="py-2 text-center font-mono text-xs">₱{plans[k].dailyCap}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
