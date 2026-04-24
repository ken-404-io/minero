"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconError,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLock,
  IconShield,
  IconWarning,
  IconX,
} from "@/components/icons";
import { API_URL } from "@/lib/api-url";

// ── Types ──────────────────────────────────────────────────────────────────

type Session = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  isCurrent: boolean;
};

type HistoryEntry = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string;
};

type Props = {
  sessions: Session[];
  loginHistory: HistoryEntry[];
  hasPassword: boolean;
  userEmail: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function parseUA(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Unknown browser", os: "Unknown device" };
  let os = "Unknown OS";
  if (/iPad/.test(ua)) os = "iPad";
  else if (/iPhone/.test(ua)) os = "iPhone";
  else if (/Android/.test(ua)) os = "Android";
  else if (/CrOS/.test(ua)) os = "Chrome OS";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Browser";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/MSIE|Trident/.test(ua)) browser = "Internet Explorer";

  return { browser, os };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

function sessionIsActive(entry: HistoryEntry): boolean {
  return !entry.revokedAt && new Date(entry.expiresAt) > new Date();
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PasswordField({
  label, value, onChange, autoComplete, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  autoComplete?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          className="input w-full pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          tabIndex={-1}
        >
          {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      </div>
    </div>
  );
}

// ── Security health checklist ──────────────────────────────────────────────

function HealthCard({
  hasPassword, activeSessions, lastLogin,
}: {
  hasPassword: boolean; activeSessions: number; lastLogin: string | null;
}) {
  const items: { ok: boolean; label: string }[] = [
    {
      ok: hasPassword,
      label: hasPassword ? "Password is set" : "No password — social sign-in only",
    },
    {
      ok: activeSessions <= 5,
      label: activeSessions === 1
        ? "1 active session"
        : activeSessions <= 5
        ? `${activeSessions} active sessions`
        : `${activeSessions} active sessions — consider revoking unused ones`,
    },
    {
      ok: true,
      label: lastLogin ? `Last sign-in ${timeAgo(lastLogin)}` : "No sign-in history",
    },
  ];

  return (
    <div
      className="card mb-6 flex flex-wrap gap-3"
      style={{ padding: "0.875rem 1rem" }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{
            background: item.ok ? "var(--success-weak)" : "var(--warning-weak, color-mix(in oklab, var(--warning) 15%, transparent))",
            color: item.ok ? "var(--success-fg)" : "var(--warning-fg)",
          }}
        >
          {item.ok
            ? <IconCheck size={11} />
            : <IconWarning size={11} />}
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SecurityClient({
  sessions: initialSessions,
  loginHistory,
  hasPassword,
  userEmail,
}: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwPending, startPwTransition] = useTransition();

  // Session revoke
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Account deletion
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  // History expand
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const visibleHistory = historyExpanded ? loginHistory : loginHistory.slice(0, 5);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function revokeSession(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`${API_URL}/auth/sessions/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeAllOthers() {
    setRevokingAll(true);
    try {
      const res = await fetch(`${API_URL}/auth/sessions`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) setSessions((prev) => prev.filter((s) => s.isCurrent));
    } finally {
      setRevokingAll(false);
    }
  }

  function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }

    startPwTransition(async () => {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setPwSuccess(true);
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
        router.refresh();
      } else {
        setPwError(typeof data.error === "string" ? data.error : "Something went wrong.");
      }
    });
  }

  function submitDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    startDeleteTransition(async () => {
      const body = hasPassword
        ? { currentPassword: deleteConfirm }
        : { confirmEmail: deleteConfirm };

      const res = await fetch(`${API_URL}/auth/account`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        router.push("/");
        router.refresh();
      } else {
        setDeleteError(typeof data.error === "string" ? data.error : "Could not delete account.");
      }
    });
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const activeSessions = sessions.length;
  const lastLogin = loginHistory[0]?.createdAt ?? null;

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-[860px] px-4 py-6 lg:px-8 lg:py-10">

        {/* Back */}
        <Link href="/me" className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: "var(--text-muted)" }}>
          <IconArrowLeft size={14} /> Account
        </Link>

        {/* Title */}
        <div className="mb-6">
          <span className="section-title">Account</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <IconShield size={24} style={{ color: "var(--brand)" }} />
            Security
          </h1>
        </div>

        {/* Health checklist */}
        <HealthCard
          hasPassword={hasPassword}
          activeSessions={activeSessions}
          lastLogin={lastLogin}
        />

        {/* Two-column: sessions + password */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start mb-6">

          {/* Active Sessions */}
          <section className="card flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <IconLock size={16} style={{ color: "var(--brand)" }} />
              <h2 className="font-semibold text-sm">Active Sessions</h2>
            </div>

            {sessions.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No active sessions.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => {
                  const { browser, os } = parseUA(s.userAgent);
                  return (
                    <li key={s.id} className="flex items-start gap-3 p-3 rounded-lg"
                      style={{ background: s.isCurrent ? "var(--brand-weak)" : "var(--surface-2)" }}>
                      <span className="inline-flex items-center justify-center rounded-md shrink-0 mt-0.5"
                        style={{
                          background: s.isCurrent ? "var(--brand)" : "var(--surface-3)",
                          color: s.isCurrent ? "var(--brand-fg)" : "var(--text-muted)",
                          width: 32, height: 32,
                        }} aria-hidden>
                        <IconLock size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{browser} · {os}</div>
                        <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {s.ip ?? "Unknown IP"} · {timeAgo(s.createdAt)}
                        </div>
                        {s.isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 px-1.5 py-0.5 rounded"
                            style={{ background: "var(--brand)", color: "var(--brand-fg)" }}>
                            <IconCheck size={10} /> This device
                          </span>
                        )}
                      </div>
                      {!s.isCurrent && (
                        <button onClick={() => revokeSession(s.id)} disabled={revokingId === s.id}
                          aria-label="Revoke session"
                          style={{
                            color: "var(--danger-fg)", background: "none", border: "none",
                            cursor: revokingId === s.id ? "not-allowed" : "pointer",
                            opacity: revokingId === s.id ? 0.5 : 1, padding: 6,
                          }}>
                          <IconX size={14} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {otherSessions.length > 1 && (
              <button onClick={revokeAllOthers} disabled={revokingAll}
                className="btn btn-sm w-full"
                style={{
                  background: "var(--danger-weak)", color: "var(--danger-fg)",
                  border: "1px solid var(--danger-weak)", opacity: revokingAll ? 0.6 : 1,
                }}>
                {revokingAll ? "Signing out…" : `Sign out ${otherSessions.length} other sessions`}
              </button>
            )}
          </section>

          {/* Change Password */}
          <section className="card">
            <div className="flex items-center gap-2 mb-4">
              <IconKey size={16} style={{ color: "var(--brand)" }} />
              <h2 className="font-semibold text-sm">Change Password</h2>
            </div>

            {!hasPassword ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Your account uses social sign-in and does not have a password.
              </p>
            ) : pwSuccess ? (
              <div className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "var(--success-weak)", color: "var(--success-fg)" }}>
                <IconCheck size={16} className="mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Password updated.</p>
                  <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
                    All other sessions have been signed out.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={submitPasswordChange} className="flex flex-col gap-4">
                <PasswordField label="Current password" value={currentPw} onChange={setCurrentPw}
                  autoComplete="current-password" disabled={pwPending} />
                <PasswordField label="New password" value={newPw} onChange={setNewPw}
                  autoComplete="new-password" disabled={pwPending} />
                <PasswordField label="Confirm new password" value={confirmPw} onChange={setConfirmPw}
                  autoComplete="new-password" disabled={pwPending} />

                {pwError && (
                  <div className="flex items-center gap-2 text-sm p-2.5 rounded-lg"
                    style={{ background: "var(--danger-weak)", color: "var(--danger-fg)" }}>
                    <IconError size={14} className="shrink-0" />{pwError}
                  </div>
                )}

                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Changing your password will sign out all other devices.
                </p>
                <button type="submit" disabled={pwPending || !currentPw || !newPw || !confirmPw}
                  className="btn btn-primary btn-sm">
                  {pwPending ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </section>
        </div>

        {/* Login History */}
        {loginHistory.length > 0 && (
          <section className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IconClock size={16} style={{ color: "var(--brand)" }} />
                <h2 className="font-semibold text-sm">Login History</h2>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Last {Math.min(loginHistory.length, 30)} sessions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left pb-2 text-xs font-semibold"
                      style={{ color: "var(--text-muted)" }}>Device</th>
                    <th className="text-left pb-2 text-xs font-semibold"
                      style={{ color: "var(--text-muted)" }}>IP</th>
                    <th className="text-left pb-2 text-xs font-semibold"
                      style={{ color: "var(--text-muted)" }}>Date</th>
                    <th className="text-right pb-2 text-xs font-semibold"
                      style={{ color: "var(--text-muted)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((entry) => {
                    const { browser, os } = parseUA(entry.userAgent);
                    const active = sessionIsActive(entry);
                    return (
                      <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-subtle, var(--border))" }}>
                        <td className="py-2.5 pr-4">
                          <div className="font-medium truncate max-w-[160px]">{browser}</div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{os}</div>
                        </td>
                        <td className="py-2.5 pr-4 text-xs font-mono"
                          style={{ color: "var(--text-muted)" }}>
                          {entry.ip ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-xs whitespace-nowrap"
                          style={{ color: "var(--text-muted)" }}>
                          {timeAgo(entry.createdAt)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: active ? "var(--success-weak)" : "var(--surface-2)",
                              color: active ? "var(--success-fg)" : "var(--text-muted)",
                            }}>
                            {active ? <IconCheck size={9} /> : <IconX size={9} />}
                            {active ? "Active" : "Ended"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {loginHistory.length > 5 && (
              <button
                onClick={() => setHistoryExpanded((e) => !e)}
                className="mt-3 text-sm"
                style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {historyExpanded
                  ? "Show less"
                  : `Show ${loginHistory.length - 5} more`}
              </button>
            )}
          </section>
        )}

        {/* Danger Zone */}
        <section
          className="card"
          style={{ borderColor: "var(--danger-weak, color-mix(in oklab, var(--danger, red) 25%, transparent))" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <IconWarning size={16} style={{ color: "var(--danger-fg, #dc2626)" }} />
            <h2 className="font-semibold text-sm" style={{ color: "var(--danger-fg, #dc2626)" }}>
              Danger Zone
            </h2>
          </div>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Permanently delete your account and all associated data — earnings, withdrawals, referrals, and sessions. This cannot be undone.
          </p>

          {!showDeleteZone ? (
            <button
              onClick={() => setShowDeleteZone(true)}
              className="btn btn-sm"
              style={{
                background: "var(--danger-weak, color-mix(in oklab, var(--danger, red) 12%, transparent))",
                color: "var(--danger-fg, #dc2626)",
                border: "1px solid var(--danger-weak, transparent)",
              }}
            >
              Delete my account
            </button>
          ) : (
            <form onSubmit={submitDeleteAccount} className="flex flex-col gap-3">
              <div
                className="p-3 rounded-lg text-sm"
                style={{ background: "var(--danger-weak, color-mix(in oklab, var(--danger, red) 10%, transparent))", color: "var(--danger-fg, #dc2626)" }}
              >
                <strong>This will permanently erase:</strong> your balance, all earnings, withdrawal history, referrals, and game data.
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {hasPassword
                    ? "Enter your current password to confirm"
                    : `Type your email address (${userEmail}) to confirm`}
                </label>
                {hasPassword ? (
                  <PasswordField
                    label=""
                    value={deleteConfirm}
                    onChange={setDeleteConfirm}
                    autoComplete="current-password"
                    disabled={deletePending}
                  />
                ) : (
                  <input
                    type="email"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={userEmail}
                    className="input"
                    disabled={deletePending}
                  />
                )}
              </div>

              {deleteError && (
                <div className="flex items-center gap-2 text-sm p-2.5 rounded-lg"
                  style={{ background: "var(--danger-weak)", color: "var(--danger-fg, #dc2626)" }}>
                  <IconError size={14} className="shrink-0" />{deleteError}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={deletePending || !deleteConfirm}
                  className="btn btn-sm"
                  style={{
                    background: "var(--danger-fg, #dc2626)", color: "#fff",
                    opacity: deletePending || !deleteConfirm ? 0.6 : 1,
                  }}>
                  {deletePending ? "Deleting…" : "Delete permanently"}
                </button>
                <button type="button" onClick={() => { setShowDeleteZone(false); setDeleteConfirm(""); setDeleteError(null); }}
                  className="btn btn-sm" disabled={deletePending}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
