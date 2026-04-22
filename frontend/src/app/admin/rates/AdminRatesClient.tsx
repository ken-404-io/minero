"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconCheck,
  IconError,
  IconArrowRight,
  IconInfo,
} from "@/components/icons";

type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };
type PlanKey = "free" | "paid";
type PlanMap = Record<PlanKey, PlanConfig>;

type Config = {
  plans: PlanMap;
  claimIntervalMs: number;
  referralCommissionRate: number;
  referralApprovalWindowMs: number;
  maxReferralsPerDay: number;
  withdrawalMinimum: number;
  estimatedAdRevenuePerClaim: number;
};

type Props = { config: Config; defaults: Config };

const PLAN_KEYS: PlanKey[] = ["free", "paid"];

export default function AdminRatesClient({ config, defaults }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Config>(config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      setSuccess("Rates updated. Live within 60 seconds.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function updatePlan(key: PlanKey, field: keyof PlanConfig, value: number | string) {
    setForm((f) => ({
      ...f,
      plans: { ...f.plans, [key]: { ...f.plans[key], [field]: value } },
    }));
  }

  function resetToDefaults() {
    setForm(defaults);
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <span className="section-title">Admin</span>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
              Platform rates
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Live-tunable. Changes propagate to all servers within 60 seconds.
            </p>
          </div>
          <button type="button" onClick={resetToDefaults} className="btn btn-secondary btn-sm">
            Reset to defaults
          </button>
        </header>

        {success && (
          <div className="alert alert-success mb-4" role="status">
            <IconCheck size={16} /> <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="alert alert-danger mb-4" role="alert">
            <IconError size={16} /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={save} className="space-y-6">
          <section className="card">
            <h2 className="font-semibold mb-1">Plans</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
              Activation fee, rate per claim, and daily cap for the single paid plan.
              &quot;Free&quot; is retained only for legacy rows where activation is still pending.
            </p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Label</th>
                    <th>₱ / claim</th>
                    <th>Daily cap ₱</th>
                    <th>Price ₱</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_KEYS.map((k) => (
                    <tr key={k}>
                      <td className="font-mono text-xs">{k}</td>
                      <td>
                        <input
                          className="input"
                          value={form.plans[k].label}
                          onChange={(e) => updatePlan(k, "label", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input font-mono"
                          type="number"
                          step="0.001"
                          min={0}
                          value={form.plans[k].ratePerClaim}
                          onChange={(e) => updatePlan(k, "ratePerClaim", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          className="input font-mono"
                          type="number"
                          step="0.01"
                          min={0}
                          value={form.plans[k].dailyCap}
                          onChange={(e) => updatePlan(k, "dailyCap", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          className="input font-mono"
                          type="number"
                          step="1"
                          min={0}
                          value={form.plans[k].price}
                          onChange={(e) => updatePlan(k, "price", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="font-semibold mb-4">Timing & limits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberField
                label="Claim interval (minutes)"
                value={Math.round(form.claimIntervalMs / 60000)}
                onChange={(v) => setForm((f) => ({ ...f, claimIntervalMs: v * 60000 }))}
                min={1}
              />
              <NumberField
                label="Referral approval window (hours)"
                value={Math.round(form.referralApprovalWindowMs / 3_600_000)}
                onChange={(v) => setForm((f) => ({ ...f, referralApprovalWindowMs: v * 3_600_000 }))}
                min={0}
              />
              <NumberField
                label="Referral commission (percent)"
                value={Math.round(form.referralCommissionRate * 1000) / 10}
                onChange={(v) => setForm((f) => ({ ...f, referralCommissionRate: v / 100 }))}
                min={0}
                max={100}
                step={0.1}
              />
              <NumberField
                label="Max referrals per day"
                value={form.maxReferralsPerDay}
                onChange={(v) => setForm((f) => ({ ...f, maxReferralsPerDay: v }))}
                min={1}
              />
              <NumberField
                label="Withdrawal minimum ₱"
                value={form.withdrawalMinimum}
                onChange={(v) => setForm((f) => ({ ...f, withdrawalMinimum: v }))}
                min={0}
              />
              <NumberField
                label="Est. ad revenue per claim ₱"
                value={form.estimatedAdRevenuePerClaim}
                onChange={(v) => setForm((f) => ({ ...f, estimatedAdRevenuePerClaim: v }))}
                min={0}
                step={0.001}
              />
            </div>
            <div className="alert alert-info mt-4">
              <IconInfo size={16} />
              <span>
                These values are cached for 60 seconds. Keep payouts &lt; ad revenue at all
                times — the goal is a positive margin.
              </span>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? "Saving…" : (<>Save changes <IconArrowRight size={16} /></>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="input-label">{label}</span>
      <input
        className="input font-mono"
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}
