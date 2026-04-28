"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconCheck,
  IconError,
  IconInfo,
  IconWarning,
} from "@/components/icons";

type SiteConfig = {
  maintenanceMode: boolean;
  announcementBanner: string;
  registrationEnabled: boolean;
  claimsEnabled: boolean;
  withdrawalsEnabled: boolean;
};

export default function AdminSiteClient({ config }: { config: SiteConfig }) {
  const router = useRouter();
  const [form, setForm] = useState<SiteConfig>(config);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function save(patch: Partial<SiteConfig>) {
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      const incoming = data.config as SiteConfig;
      setForm((f) => ({ ...f, ...incoming }));
      setSuccess("Saved — live within 60 seconds.");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function toggle(field: keyof Omit<SiteConfig, "announcementBanner">) {
    const next = !form[field];
    setForm((f) => ({ ...f, [field]: next }));
    save({ [field]: next });
  }

  function saveBanner(e: React.FormEvent) {
    e.preventDefault();
    save({ announcementBanner: form.announcementBanner });
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[900px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-6">
          <span className="section-title">Admin</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Site controls</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            All toggles are live — changes propagate within 60 seconds, no redeploy needed.
          </p>
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

        {/* Maintenance mode — highlighted if on */}
        {form.maintenanceMode && (
          <div className="alert mb-4" role="alert" style={{ background: "var(--brand-weak)", borderColor: "var(--brand)", color: "var(--brand)" }}>
            <IconWarning size={16} />
            <span>
              Maintenance mode is <strong>ON</strong> — all non-admin users see a maintenance page.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* ─── Announcement banner ─── */}
          <section className="card">
            <h2 className="font-semibold mb-1">Announcement banner</h2>
            <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
              Shown as a dismissible banner at the top of every page for all users. Leave empty to hide it.
            </p>
            <form onSubmit={saveBanner} className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="e.g. Scheduled maintenance on Sunday 2AM–4AM. Plan accordingly."
                value={form.announcementBanner}
                onChange={(e) => setForm((f) => ({ ...f, announcementBanner: e.target.value }))}
                maxLength={500}
              />
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "…" : "Save"}
              </button>
            </form>
            {form.announcementBanner && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-sm flex items-start gap-2"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                <IconInfo size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>Preview: {form.announcementBanner}</span>
              </div>
            )}
          </section>

          {/* ─── Feature toggles ─── */}
          <section className="card">
            <h2 className="font-semibold mb-4">Feature toggles</h2>
            <div className="flex flex-col gap-3">
              <ToggleRow
                label="Maintenance mode"
                description="Non-admin users see a maintenance page instead of the app. Admins are unaffected."
                checked={form.maintenanceMode}
                danger
                onChange={() => toggle("maintenanceMode")}
                disabled={saving}
              />
              <ToggleRow
                label="New registrations"
                description="Allow new users to create accounts. Disable to pause sign-ups."
                checked={form.registrationEnabled}
                onChange={() => toggle("registrationEnabled")}
                disabled={saving}
              />
              <ToggleRow
                label="Claims"
                description="Allow users to claim rewards. Disable during rate adjustments or maintenance."
                checked={form.claimsEnabled}
                onChange={() => toggle("claimsEnabled")}
                disabled={saving}
              />
              <ToggleRow
                label="Withdrawals"
                description="Allow users to submit withdrawal requests. Disable while processing a large batch."
                checked={form.withdrawalsEnabled}
                onChange={() => toggle("withdrawalsEnabled")}
                disabled={saving}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  danger,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const id = `toggle-${label.replace(/\s/g, "-").toLowerCase()}`;
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-lg px-4 py-3"
      style={{
        background: "var(--surface-2)",
        borderLeft: danger && checked ? "3px solid var(--color-danger, #ef4444)" : "3px solid transparent",
      }}
    >
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer block">{label}</label>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className="shrink-0 relative inline-flex items-center rounded-full transition-colors"
        style={{
          width: 44,
          height: 24,
          background: checked ? (danger ? "var(--color-danger, #ef4444)" : "var(--brand)") : "var(--surface-3, var(--border-strong))",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          className="absolute inline-block rounded-full transition-transform"
          style={{
            width: 18,
            height: 18,
            background: "#fff",
            left: 3,
            transform: checked ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}
