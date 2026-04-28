"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import { deviceHeaders } from "@/lib/device";
import OAuthButtons from "@/components/OAuthButtons";
import MiningAnimation from "@/components/MiningAnimation";
import AuthOverlay from "@/components/AuthOverlay";
import {
  IconPickaxe,
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconError,
} from "@/components/icons";

function humanizeOAuthError(code: string | null): string | null {
  if (!code) return null;
  if (code === "state_mismatch") return "Sign-in was interrupted. Please try again.";
  if (code === "account_suspended") return "Your account is suspended.";
  if (code === "bad_callback") return "Sign-in failed. Please try again.";
  if (code.startsWith("email_uses_")) {
    const other = code.slice("email_uses_".length);
    return `That email already signed in with ${other}. Use ${other} to continue.`;
  }
  if (code === "facebook_missing_email") {
    return "Facebook didn't share your email. Grant email permission and retry.";
  }
  return `Sign-in failed: ${code.replace(/_/g, " ")}`;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = humanizeOAuthError(searchParams.get("error"));
  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const bannerError = submitError || oauthError || "";

  function set(field: "email" | "password", val: string) {
    setForm((f) => ({ ...f, [field]: val }));
    if (fieldErrors[field]) {
      setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
    }
  }

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.password) next.password = "Password is required";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(await deviceHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Login failed");
        setLoading(false);
      } else {
        router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
        router.refresh();
        // Keep loading=true so the overlay stays until navigation completes.
      }
    } catch {
      setSubmitError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
    {loading && <AuthOverlay mode="in" />}
    <div className="h-screen overflow-hidden grid lg:grid-cols-2">
      {/* ==================== Left: brand panel (desktop only) ==================== */}
      <aside
        className="hidden lg:flex flex-col justify-between p-10 border-r"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
      >
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Minero home">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
          >
            <IconPickaxe size={20} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Minero</span>
        </Link>

        <div>
          <MiningAnimation />
          <h2 className="text-3xl font-bold tracking-tight mt-6">Welcome back.</h2>
          <p className="mt-3 text-base max-w-md" style={{ color: "var(--text-muted)" }}>
            Sign in to continue mining. Your balance and referrals are waiting for you.
          </p>
          <ul className="mt-6 space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {[
              "Claim every 10 minutes",
              "10% forever referral commission",
              "Cash out to GCash or Maya",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--brand)" }}
                />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          © 2026 Halvex Inc. · Minero
        </div>
      </aside>

      {/* ==================== Right: form (full-width on mobile) ==================== */}
      <main className="flex flex-col px-4 py-8 lg:p-10 overflow-y-auto">
        {/* Mobile brand */}
        <Link href="/" className="lg:hidden inline-flex items-center gap-2 mb-8" aria-label="Minero home">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
          >
            <IconPickaxe size={20} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Minero</span>
        </Link>

        <div className="w-full max-w-sm mx-auto my-auto">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-center">Sign in</h1>
          <p className="text-sm mt-1 mb-6 text-center" style={{ color: "var(--text-muted)" }}>
            Enter your credentials to continue.
          </p>

          {bannerError && (
            <div className="alert alert-danger mb-4" role="alert">
              <IconError size={16} />
              <span>{bannerError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="input-label">Email</label>
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
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-error" className="input-error" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="input-label">Password</label>
              <div className="relative">
                <IconLock
                  size={16}
                  style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                />
                <input
                  id="password"
                  className="input"
                  style={{ paddingLeft: 36, paddingRight: 44 }}
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
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
              {fieldErrors.password && (
                <p id="password-error" className="input-error" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
              {loading ? "Signing in…" : (
                <>
                  Sign in <IconArrowRight size={16} />
                </>
              )}
            </button>
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs link-brand">
                Forgot password?
              </Link>
            </div>
          </form>

          <div className="mt-5">
            <OAuthButtons />
          </div>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
            No account?{" "}
            <Link href="/register" className="link-brand">
              Register
            </Link>
          </p>
        </div>
      </main>
    </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
