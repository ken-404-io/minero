"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export default function WithdrawClient({ balance, pendingBalance, withdrawals, minimum }: Props) {
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/withdraw`, {
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

  return (
    <div className="p-6 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">Withdraw</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="card">
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Available to Withdraw</div>
          <div className="text-3xl font-extrabold" style={{ color: "var(--gold)" }}>₱{balance.toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Pending (not withdrawable)</div>
          <div className="text-3xl font-extrabold" style={{ color: "var(--muted)" }}>₱{pendingBalance.toFixed(2)}</div>
        </div>
      </div>

      {/* Request form */}
      <div className="card mb-8">
        <h2 className="font-bold mb-4">Request Withdrawal</h2>
        {!canWithdraw ? (
          <div className="text-center py-4">
            <p style={{ color: "var(--muted)" }} className="text-sm">
              Minimum withdrawal is <strong style={{ color: "var(--gold)" }}>₱{minimum}</strong>. Keep mining!
            </p>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, (balance / minimum) * 100)}%`, background: "var(--gold)" }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>₱{balance.toFixed(2)} / ₱{minimum}</p>
          </div>
        ) : hasPending ? (
          <div className="text-sm p-3 rounded-lg" style={{ background: "#2d2000", color: "#f59e0b" }}>
            You already have a pending withdrawal. Please wait for it to be processed.
          </div>
        ) : success ? (
          <div className="text-sm p-3 rounded-lg" style={{ background: "#0a2e1a", color: "#34d399" }}>
            ✓ Withdrawal request submitted. Processing takes 3–7 business days.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>
                Amount (min ₱{minimum})
              </label>
              <input
                className="input"
                type="number"
                step="0.01"
                min={minimum}
                max={balance}
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={`${minimum}.00`}
              />
              <div className="flex gap-2 mt-2">
                {[minimum, Math.floor(balance / 2), Math.floor(balance)].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}
                    onClick={() => setForm((f) => ({ ...f, amount: v.toString() }))}
                  >
                    ₱{v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>Payment Method</label>
              <div className="flex gap-3">
                {["gcash", "maya"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors`}
                    onClick={() => setForm((f) => ({ ...f, method: m }))}
                    style={
                      form.method === m
                        ? { background: "var(--gold)", color: "#000", borderColor: "var(--gold)" }
                        : { background: "var(--surface-2)", color: "var(--muted)", borderColor: "var(--border)" }
                    }
                  >
                    {m === "gcash" ? "GCash" : "Maya"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>
                {form.method === "gcash" ? "GCash" : "Maya"} Number
              </label>
              <input
                className="input"
                type="tel"
                required
                pattern="[0-9]{10,11}"
                value={form.accountNumber}
                onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                placeholder="09XXXXXXXXX"
              />
            </div>
            {error && <div className="text-sm" style={{ color: "#f87171" }}>{error}</div>}
            <button className="btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Submitting…" : "Request Withdrawal"}
            </button>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Processing takes 3–7 business days. Pending earnings are not included. Fraud detected during review will cancel the request.
            </p>
          </form>
        )}
      </div>

      {/* History */}
      <div className="card">
        <h2 className="font-bold mb-4">Withdrawal History</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>No withdrawals yet.</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="font-medium">₱{w.amount.toFixed(2)} → {w.method === "gcash" ? "GCash" : "Maya"} {w.accountNumber}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                    {new Date(w.requestedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    {w.processedAt && ` · Processed ${new Date(w.processedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`}
                  </div>
                </div>
                <span className={`badge badge-${w.status}`}>{w.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
