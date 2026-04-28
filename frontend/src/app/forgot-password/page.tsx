"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconPickaxe,
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconCheck,
  IconError,
} from "@/components/icons";

type Step = "email" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  // Step 1 — email
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Step 2 — code + new password
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailLoading(true);
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always advance — backend never reveals if email exists.
      setStep("reset");
    } catch {
      setEmailError("Network error. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    if (code.length < 4) { setResetError("Enter the 6-digit code from your email."); return; }
    if (newPassword.length < 8) { setResetError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setResetError("Passwords do not match."); return; }

    setResetLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setResetError(
          typeof data.error === "string" ? data.error : "Invalid or expired code."
        );
      }
    } catch {
      setResetError("Network error. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <Link href="/" className="inline-flex items-center gap-2 mb-8" aria-label="Minero home">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
          >
            <IconPickaxe size={20} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Minero</span>
        </Link>

        {done ? (
          <div className="card text-center" style={{ padding: "2rem" }}>
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-4"
              style={{ background: "var(--success-weak)", color: "var(--success-fg)" }}
            >
              <IconCheck size={24} />
            </span>
            <h1 className="text-xl font-bold tracking-tight">Password updated!</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Redirecting you to sign in…
            </p>
          </div>
        ) : step === "email" ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Forgot password?</h1>
            <p className="mt-1 mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Enter your email and we&apos;ll send you a 6-digit code.
            </p>

            {emailError && (
              <div className="alert alert-danger mb-4" role="alert">
                <IconError size={16} />
                <span>{emailError}</span>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="email" className="input-label">Email address</label>
                <div className="relative">
                  <IconMail
                    size={16}
                    style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                  />
                  <input
                    id="email"
                    className="input"
                    style={{ paddingLeft: 36 }}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full btn-lg"
                disabled={emailLoading}
              >
                {emailLoading ? "Sending code…" : (
                  <>Send reset code <IconArrowRight size={16} /></>
                )}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
              Remembered it?{" "}
              <Link href="/login" className="link-brand">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
            <p className="mt-1 mb-6 text-sm" style={{ color: "var(--text-muted)" }}>
              We sent a 6-digit code to{" "}
              <span className="font-medium" style={{ color: "var(--text)" }}>{email}</span>.
              Enter it below along with your new password.
            </p>

            {resetError && (
              <div className="alert alert-danger mb-4" role="alert">
                <IconError size={16} />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="code" className="input-label">Verification code</label>
                <input
                  id="code"
                  className="input font-mono tracking-widest text-center text-lg"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="123456"
                  maxLength={8}
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="new-password" className="input-label">New password</label>
                <div className="relative">
                  <IconLock
                    size={16}
                    style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                  />
                  <input
                    id="new-password"
                    className="input"
                    style={{ paddingLeft: 36, paddingRight: 44 }}
                    type={showPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="btn-icon"
                    style={{ position: "absolute", right: 4, top: 4, height: 36, width: 36 }}
                  >
                    {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="input-label">Confirm new password</label>
                <div className="relative">
                  <IconLock
                    size={16}
                    style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                  />
                  <input
                    id="confirm-password"
                    className="input"
                    style={{ paddingLeft: 36 }}
                    type={showPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full btn-lg"
                disabled={resetLoading}
              >
                {resetLoading ? "Saving password…" : (
                  <>Set new password <IconArrowRight size={16} /></>
                )}
              </button>
            </form>

            <button
              type="button"
              className="mt-4 text-sm w-full text-center"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => { setStep("email"); setCode(""); setResetError(""); }}
            >
              Wrong email? Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
