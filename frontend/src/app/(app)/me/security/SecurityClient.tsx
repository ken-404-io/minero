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
  IconX,
} from "@/components/icons";
import { API_URL } from "@/lib/api-url";

type Session = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  isCurrent: boolean;
};

type Props = {
  sessions: Session[];
  hasPassword: boolean;
};

// ── User-agent parser ──────────────────────────────────────────────────────

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
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Password input with show/hide ──────────────────────────────────────────

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" style={{ color: "var(--text)" }}>
        {label}
      </label>
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

// ── Main component ─────────────────────────────────────────────────────────

export default function SecurityClient({ sessions: initialSessions, hasPassword }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwPending, startPwTransition] = useTransition();

  // Session revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function revokeSession(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`${API_URL}/auth/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeAllOthers() {
    setRevokingAll(true);
    try {
      const res = await fetch(`${API_URL}/auth/sessions`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      }
    } finally {
      setRevokingAll(false);
    }
  }

  function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }

    startPwTransition(async () => {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setPwSuccess(true);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        // Other sessions were revoked — refresh session list
        router.refresh();
      } else {
        setPwError(
          typeof data.error === "string" ? data.error : "Something went wrong."
        );
      }
    });
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-[860px] px-4 py-6 lg:px-8 lg:py-10">

        {/* Back link */}
        <Link
          href="/me"
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          <IconArrowLeft size={14} />
          Account
        </Link>

        {/* Page title */}
        <div className="mb-8">
          <span className="section-title">Account</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1 flex items-center gap-2">
            <IconShield size={24} style={{ color: "var(--brand)" }} />
            Security
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Manage your active sessions and password.
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">

          {/* ── Active Sessions ─────────────────────────────────────────── */}
          <section className="card flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <IconClock size={16} style={{ color: "var(--brand)" }} />
              <h2 className="font-semibold text-sm">Active Sessions</h2>
            </div>

            {sessions.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No active sessions found.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => {
                  const { browser, os } = parseUA(s.userAgent);
                  return (
                    <li
                      key={s.id}
                      className="flex items-start gap-3 p-3 rounded-lg"
                      style={{
                        background: s.isCurrent
                          ? "var(--brand-weak)"
                          : "var(--surface-2)",
                      }}
                    >
                      <span
                        className="inline-flex items-center justify-center rounded-md shrink-0 mt-0.5"
                        style={{
                          background: s.isCurrent ? "var(--brand)" : "var(--surface-3)",
                          color: s.isCurrent ? "var(--brand-fg)" : "var(--text-muted)",
                          width: 32,
                          height: 32,
                        }}
                        aria-hidden
                      >
                        <IconLock size={14} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {browser} · {os}
                        </div>
                        <div
                          className="text-xs truncate mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {s.ip ?? "Unknown IP"} · {fmtDate(s.createdAt)}
                        </div>
                        {s.isCurrent && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold mt-1 px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--brand)",
                              color: "var(--brand-fg)",
                            }}
                          >
                            <IconCheck size={10} /> This device
                          </span>
                        )}
                      </div>
                      {!s.isCurrent && (
                        <button
                          onClick={() => revokeSession(s.id)}
                          disabled={revokingId === s.id}
                          aria-label="Revoke this session"
                          className="shrink-0 p-1.5 rounded-md"
                          style={{
                            color: "var(--danger-fg)",
                            background: "transparent",
                            border: "none",
                            cursor: revokingId === s.id ? "not-allowed" : "pointer",
                            opacity: revokingId === s.id ? 0.5 : 1,
                          }}
                        >
                          <IconX size={14} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {otherSessions.length > 1 && (
              <button
                onClick={revokeAllOthers}
                disabled={revokingAll}
                className="btn btn-sm w-full"
                style={{
                  background: "var(--danger-weak)",
                  color: "var(--danger-fg)",
                  border: "1px solid var(--danger-weak)",
                  opacity: revokingAll ? 0.6 : 1,
                }}
              >
                {revokingAll ? "Signing out…" : `Sign out ${otherSessions.length} other sessions`}
              </button>
            )}
          </section>

          {/* ── Change Password ─────────────────────────────────────────── */}
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
              <div
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: "var(--success-weak)", color: "var(--success-fg)" }}
              >
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
                <PasswordField
                  label="Current password"
                  value={currentPw}
                  onChange={setCurrentPw}
                  autoComplete="current-password"
                  disabled={pwPending}
                />
                <PasswordField
                  label="New password"
                  value={newPw}
                  onChange={setNewPw}
                  autoComplete="new-password"
                  disabled={pwPending}
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPw}
                  onChange={setConfirmPw}
                  autoComplete="new-password"
                  disabled={pwPending}
                />

                {pwError && (
                  <div
                    className="flex items-center gap-2 text-sm p-2.5 rounded-lg"
                    style={{ background: "var(--danger-weak)", color: "var(--danger-fg)" }}
                  >
                    <IconError size={14} className="shrink-0" />
                    {pwError}
                  </div>
                )}

                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Changing your password will sign out all other devices.
                </p>

                <button
                  type="submit"
                  disabled={pwPending || !currentPw || !newPw || !confirmPw}
                  className="btn btn-primary btn-sm"
                >
                  {pwPending ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
