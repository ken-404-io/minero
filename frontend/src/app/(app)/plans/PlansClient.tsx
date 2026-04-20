"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconCheck,
  IconSparkles,
  IconX,
  IconArrowRight,
} from "@/components/icons";

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

  // Lock body scroll when sheet open
  useEffect(() => {
    if (selectedPlan) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [selectedPlan]);

  async function handleUpgrade() {
    if (!selectedPlan || !paymentRef.trim()) return;
    setUpgrading(selectedPlan);
    setError("");
    try {
      const res = await fetch(`${API_URL}/plans/upgrade`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan, paymentRef }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(
          `Upgrade to ${data.label} submitted. Your plan will activate once our team verifies your payment (usually within 24 hours).`,
        );
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
    <div className="w-full">
      {/* ============================================================
         DESKTOP (≥1024) — feature comparison grid + side panel
         ============================================================ */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <header className="mb-8">
            <span className="section-title">Upgrade</span>
            <h1 className="text-3xl font-bold tracking-tight mt-1">Mining plans</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              One-time payment. Non-refundable. Lifetime access.
            </p>
          </header>

          {success && (
            <div className="alert alert-success mb-6" role="status">
              <IconCheck size={16} />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-8">
            {planOrder.map((key) => {
              const plan = plans[key];
              const idx = planOrder.indexOf(key);
              const isCurrent = key === currentPlan;
              const canUpgrade = idx > currentIdx && key !== "free";
              const isSelected = selectedPlan === key;
              const best = key === "plan799";

              return (
                <div
                  key={key}
                  className="card card-hover flex flex-col gap-4"
                  style={
                    isCurrent
                      ? { borderColor: "var(--brand)", background: "var(--bg-elevated)" }
                      : isSelected
                      ? { borderColor: "var(--info)" }
                      : {}
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{plan.label.replace(" Plan", "")}</span>
                    {isCurrent ? (
                      <span className="badge badge-approved">
                        <IconCheck size={12} /> Current
                      </span>
                    ) : best ? (
                      <span className="badge badge-plan799">Best value</span>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-4xl font-bold" style={{ color: "var(--brand)" }}>
                      {plan.price === 0 ? "Free" : `₱${plan.price}`}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>
                      {plan.price === 0 ? "Forever" : "One-time · lifetime"}
                    </div>
                  </div>

                  <ul className="space-y-2 text-sm flex-1">
                    <Feature>₱{plan.ratePerClaim} per claim</Feature>
                    <Feature>₱{plan.dailyCap} daily cap</Feature>
                    <Feature>10% referral commission</Feature>
                    <Feature>{plan.price === 0 ? "No payment" : "Manual review"}</Feature>
                  </ul>

                  {canUpgrade ? (
                    <button
                      onClick={() => setSelectedPlan(isSelected ? null : key)}
                      className={isSelected ? "btn btn-secondary" : "btn btn-primary"}
                    >
                      {isSelected ? "Cancel" : "Select plan"}
                    </button>
                  ) : isCurrent ? (
                    <button className="btn btn-secondary" disabled>
                      Active
                    </button>
                  ) : (
                    <button className="btn btn-ghost" disabled>
                      Not available
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Comparison table */}
          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="font-semibold">Compare plans</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  {planOrder.map((k) => (
                    <th
                      key={k}
                      className="text-center"
                      style={{ color: k === currentPlan ? "var(--brand)" : undefined }}
                    >
                      {plans[k].label.replace(" Plan", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rate per claim</td>
                  {planOrder.map((k) => (
                    <td key={k} className="text-center font-mono">
                      ₱{plans[k].ratePerClaim}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Daily cap</td>
                  {planOrder.map((k) => (
                    <td key={k} className="text-center font-mono">
                      ₱{plans[k].dailyCap}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Referral commission</td>
                  {planOrder.map((k) => (
                    <td key={k} className="text-center">10%</td>
                  ))}
                </tr>
                <tr>
                  <td>Minimum withdrawal</td>
                  {planOrder.map((k) => (
                    <td key={k} className="text-center font-mono">₱300</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {/* ============================================================
         MOBILE (<1024) — vertical stacked cards
         ============================================================ */}
      <div className="lg:hidden">
        <div className="px-4 pt-4 pb-6">
          <h1 className="text-2xl font-bold tracking-tight">Mining plans</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
            One-time payment · lifetime access
          </p>

          {success && (
            <div className="alert alert-success mb-4" role="status">
              <IconCheck size={16} />
              <span>{success}</span>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {planOrder.map((key) => {
              const plan = plans[key];
              const idx = planOrder.indexOf(key);
              const isCurrent = key === currentPlan;
              const canUpgrade = idx > currentIdx && key !== "free";

              return (
                <li
                  key={key}
                  className="card flex flex-col gap-3"
                  style={
                    isCurrent
                      ? { borderColor: "var(--brand)", background: "var(--bg-elevated)" }
                      : {}
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{plan.label}</div>
                      <div
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: "var(--brand)" }}
                      >
                        {plan.price === 0 ? "Free" : `₱${plan.price}`}
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="badge badge-approved">
                        <IconCheck size={12} /> Active
                      </span>
                    ) : key === "plan799" ? (
                      <span className="badge badge-plan799">Best value</span>
                    ) : null}
                  </div>

                  <ul className="grid grid-cols-2 gap-2 text-sm">
                    <Feature>₱{plan.ratePerClaim}/claim</Feature>
                    <Feature>₱{plan.dailyCap}/day</Feature>
                  </ul>

                  {canUpgrade && (
                    <button
                      onClick={() => setSelectedPlan(key)}
                      className="btn btn-primary"
                    >
                      <IconSparkles size={16} /> Upgrade to {plan.label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ============================================================
         Payment sheet (bottom-sheet mobile, centered dialog desktop)
         ============================================================ */}
      {selectedPlan && (
        <>
          <div
            className="sheet-scrim"
            onClick={() => { setSelectedPlan(null); setError(""); }}
            aria-hidden
          />
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-sheet-title"
          >
            <div className="sheet-handle" aria-hidden />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="section-title">Upgrade</span>
                <h2 id="plan-sheet-title" className="text-xl font-semibold mt-1">
                  {plans[selectedPlan].label}
                </h2>
              </div>
              <button
                onClick={() => { setSelectedPlan(null); setError(""); }}
                className="btn-icon"
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="surface-2 p-4 mb-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Amount to pay
                </span>
                <span className="text-2xl font-bold" style={{ color: "var(--brand)" }}>
                  ₱{plans[selectedPlan].price}
                </span>
              </div>
            </div>

            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
              Send payment via GCash or Maya to:
            </p>
            <div className="surface-2 p-3 mb-4 font-mono text-sm" style={{ color: "var(--brand)" }}>
              <div>GCash / Maya: 09XX-XXX-XXXX</div>
              <div>Name: Halvex Inc.</div>
            </div>

            <label htmlFor="paymentRef" className="input-label">
              GCash/Maya reference number
            </label>
            <input
              id="paymentRef"
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1234567890"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              autoFocus
            />

            {error && (
              <div className="alert alert-danger mt-3" role="alert">
                {error}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setSelectedPlan(null); setError(""); }}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={!!upgrading || !paymentRef.trim()}
                className="btn btn-primary flex-1"
              >
                {upgrading ? "Submitting…" : (
                  <>
                    Confirm <IconArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
              Non-refundable. Reviewed manually within 24 hours.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <IconCheck size={14} style={{ color: "var(--success-fg)" }} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
