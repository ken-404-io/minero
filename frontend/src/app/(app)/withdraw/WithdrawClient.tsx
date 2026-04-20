"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconWallet,
  IconCheck,
  IconClock,
  IconError,
  IconArrowRight,
  IconInfo,
} from "@/components/icons";

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  requestedAt: string | Date;
  processedAt: string | Date | null;
};

type Props = {
  balance: number;
  pendingBalance: number;
  withdrawals: Withdrawal[];
  minimum: number;
};

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusIcon(status: string, size = 14) {
  if (status === "approved")
    return <IconCheck size={size} style={{ color: "var(--success-fg)" }} />;
  if (status === "pending")
    return <IconClock size={size} style={{ color: "var(--warning-fg)" }} />;
  return <IconError size={size} style={{ color: "var(--danger-fg)" }} />;
}

export default function WithdrawClient({
  balance,
  pendingBalance,
  withdrawals,
  minimum,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ amount: "", method: "gcash", accountNumber: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const canWithdraw = balance >= minimum;
  const hasPending = withdrawals.some((w) => w.status === "pending");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount < minimum) {
      setError(`Minimum withdrawal is ₱${minimum}`);
      return;
    }
    if (amount > balance) {
      setError("Insufficient balance");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/withdraw`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: form.method, accountNumber: form.accountNumber }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        router.refresh();
      } else {
        setError(typeof data.error === "string" ? data.error : "Request failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const progressPct = Math.min(100, (balance / minimum) * 100);

  return (
    <div className="w-full">
      {/* ================================================================
         DESKTOP (≥1024) — split view: form + history side by side
         ================================================================ */}
      <div className="hidden lg:block">
        <div className="mx-auto max-w-[1280px] px-8 py-8">
          <header className="mb-6">
            <span className="section-title">Cash out</span>
            <h1 className="text-3xl font-bold tracking-tight mt-1">Withdraw</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Transfer funds to GCash or Maya · 3–7 business days
            </p>
          </header>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="kpi">
              <span className="kpi-label">Available to withdraw</span>
              <span className="kpi-value kpi-value-brand">₱{balance.toFixed(2)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Pending</span>
              <span className="kpi-value" style={{ color: "var(--text-muted)" }}>
                ₱{pendingBalance.toFixed(2)}
              </span>
              <span className="kpi-delta">Not yet withdrawable</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Minimum</span>
              <span className="kpi-value">₱{minimum}</span>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-6">
            {/* Left: form */}
            <section className="card">
              <h2 className="font-semibold text-lg mb-4">Request withdrawal</h2>
              <FormBody
                balance={balance}
                canWithdraw={canWithdraw}
                hasPending={hasPending}
                success={success}
                form={form}
                setForm={setForm}
                error={error}
                loading={loading}
                minimum={minimum}
                progressPct={progressPct}
                onSubmit={handleSubmit}
              />
            </section>

            {/* Right: history */}
            <aside className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div
                className="px-5 py-4 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <h2 className="font-semibold">History</h2>
              </div>
              {withdrawals.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No withdrawals yet
                  </p>
                </div>
              ) : (
                <ul>
                  {withdrawals.map((w) => (
                    <li
                      key={w.id}
                      className="px-5 py-3 flex items-start justify-between gap-3 border-b last:border-b-0"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div>
                        <div className="font-mono font-semibold tabular-nums">
                          ₱{w.amount.toFixed(2)}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {w.method === "gcash" ? "GCash" : "Maya"} · {w.accountNumber}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                          {fmtDate(w.requestedAt)}
                        </div>
                      </div>
                      <span className={`badge badge-${w.status}`}>
                        {statusIcon(w.status)}
                        {w.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* ================================================================
         MOBILE (<1024) — stacked, form first (thumb-first)
         ================================================================ */}
      <div className="lg:hidden">
        <div className="px-4 pt-4 pb-6">
          <h1 className="text-2xl font-bold tracking-tight">Withdraw</h1>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
            3–7 business days to GCash or Maya
          </p>

          {/* Balance hero */}
          <section className="card mb-4" style={{ background: "var(--bg-elevated)" }}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Available
              </span>
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                Pending ₱{pendingBalance.toFixed(2)}
              </span>
            </div>
            <div className="text-4xl font-bold tabular-nums mt-1" style={{ color: "var(--brand)" }}>
              ₱{balance.toFixed(2)}
            </div>
            {!canWithdraw && (
              <>
                <div
                  className="progress mt-3"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                  ₱{balance.toFixed(2)} of ₱{minimum} minimum
                </div>
              </>
            )}
          </section>

          <section className="card mb-4">
            <h2 className="font-semibold mb-3">Request withdrawal</h2>
            <FormBody
              balance={balance}
              canWithdraw={canWithdraw}
              hasPending={hasPending}
              success={success}
              form={form}
              setForm={setForm}
              error={error}
              loading={loading}
              minimum={minimum}
              progressPct={progressPct}
              onSubmit={handleSubmit}
            />
          </section>

          <section>
            <h2 className="font-semibold mb-2 px-1">History</h2>
            {withdrawals.length === 0 ? (
              <div
                className="card text-center"
                style={{ color: "var(--text-muted)" }}
              >
                <p className="text-sm">No withdrawals yet</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {withdrawals.map((w) => (
                  <li
                    key={w.id}
                    className="surface p-3 flex items-center justify-between gap-3"
                    style={{ borderRadius: "var(--radius-lg)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ background: "var(--surface-2)", color: "var(--brand)" }}
                      >
                        <IconWallet size={18} />
                      </span>
                      <div>
                        <div className="font-mono font-semibold tabular-nums">
                          ₱{w.amount.toFixed(2)}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {w.method === "gcash" ? "GCash" : "Maya"} · {fmtDate(w.requestedAt)}
                        </div>
                      </div>
                    </div>
                    <span className={`badge badge-${w.status}`}>
                      {statusIcon(w.status)}
                      {w.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shared form body ---------- */
function FormBody({
  balance,
  canWithdraw,
  hasPending,
  success,
  form,
  setForm,
  error,
  loading,
  minimum,
  progressPct,
  onSubmit,
}: {
  balance: number;
  canWithdraw: boolean;
  hasPending: boolean;
  success: boolean;
  form: { amount: string; method: string; accountNumber: string };
  setForm: React.Dispatch<React.SetStateAction<{ amount: string; method: string; accountNumber: string }>>;
  error: string;
  loading: boolean;
  minimum: number;
  progressPct: number;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (!canWithdraw) {
    return (
      <div>
        <div className="alert alert-info mb-3">
          <IconInfo size={16} />
          <div>
            <div className="font-semibold">Below minimum</div>
            <div className="text-sm">Keep mining until you reach ₱{minimum}.</div>
          </div>
        </div>
        <div className="progress mb-1.5" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          ₱{balance.toFixed(2)} of ₱{minimum}
        </div>
      </div>
    );
  }
  if (hasPending) {
    return (
      <div className="alert alert-warning">
        <IconClock size={16} />
        <div>
          <div className="font-semibold">Pending request</div>
          <div className="text-sm">Wait for it to finish before requesting another.</div>
        </div>
      </div>
    );
  }
  if (success) {
    return (
      <div className="alert alert-success">
        <IconCheck size={16} />
        <div>
          <div className="font-semibold">Request submitted</div>
          <div className="text-sm">Processing takes 3–7 business days.</div>
        </div>
      </div>
    );
  }

  const quickAmounts = [minimum, Math.floor(balance / 2), Math.floor(balance)]
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="amount" className="input-label">
          Amount <span style={{ color: "var(--text-subtle)" }}>(min ₱{minimum})</span>
        </label>
        <input
          id="amount"
          className="input font-mono"
          type="number"
          step="0.01"
          min={minimum}
          max={balance}
          inputMode="decimal"
          required
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder={`${minimum}.00`}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {quickAmounts.map((v) => (
            <button
              key={v}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
              onClick={() => setForm((f) => ({ ...f, amount: v.toString() }))}
            >
              ₱{v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="input-label">Payment method</span>
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-3">
          {(["gcash", "maya"] as const).map((m) => {
            const active = form.method === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setForm((f) => ({ ...f, method: m }))}
                className="surface-2 flex items-center justify-center py-3 font-semibold text-sm"
                style={
                  active
                    ? {
                        background: "var(--brand-weak)",
                        color: "var(--brand-weak-fg)",
                        borderColor: "var(--brand)",
                      }
                    : {
                        color: "var(--text-muted)",
                      }
                }
              >
                {m === "gcash" ? "GCash" : "Maya"}
                {active && <IconCheck size={14} className="ml-2" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="account" className="input-label">
          {form.method === "gcash" ? "GCash" : "Maya"} number
        </label>
        <input
          id="account"
          className="input font-mono"
          type="tel"
          inputMode="tel"
          required
          pattern="[0-9]{10,11}"
          value={form.accountNumber}
          onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          placeholder="09XXXXXXXXX"
        />
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <IconError size={16} />
          <span>{error}</span>
        </div>
      )}

      <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
        {loading ? "Submitting…" : (
          <>
            Request withdrawal <IconArrowRight size={16} />
          </>
        )}
      </button>
      <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
        Pending earnings are not included. Fraud detected during review will cancel the request.
      </p>
    </form>
  );
}
