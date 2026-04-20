"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import { deviceHeaders } from "@/lib/device";
import OAuthButtons from "@/components/OAuthButtons";
import MiningAnimation from "@/components/MiningAnimation";
import {
  IconPickaxe,
  IconMail,
  IconLock,
  IconUser,
  IconGift,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconError,
  IconCheck,
} from "@/components/icons";

type RegisterFields = "name" | "email" | "password" | "referralCode";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    referralCode: searchParams.get("ref") ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterFields, string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function set(field: RegisterFields, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
    if (fieldErrors[field]) {
      setFieldErrors((fe) => ({ ...fe, [field]: undefined }));
    }
  }

  function validate() {
    const next: Partial<Record<RegisterFields, string>> = {};
    if (!form.name.trim()) next.name = "Full name is required";
    else if (form.name.trim().length < 2) next.name = "Name is too short";

    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";

    if (!form.password) next.password = "Password is required";
    else if (form.password.length < 8) next.password = "Must be at least 8 characters";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError("");
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(await deviceHeaders()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error && typeof data.error === "object") {
          // backend returned zod field errors — map them to fieldErrors
          const mapped: Partial<Record<RegisterFields, string>> = {};
          for (const [k, v] of Object.entries(data.error)) {
            if (Array.isArray(v) && v.length > 0) {
              mapped[k as RegisterFields] = String(v[0]);
            }
          }
          setFieldErrors(mapped);
        } else {
          setSubmitError(typeof data.error === "string" ? data.error : "Registration failed");
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const pwStrong = form.password.length >= 8;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
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
          <h2 className="text-3xl font-bold tracking-tight mt-6">Earn real pesos.</h2>
          <p className="mt-3 text-base max-w-md" style={{ color: "var(--text-muted)" }}>
            Register in 30 seconds. Claim every 10 minutes. Cash out to GCash or Maya.
          </p>
          <ul className="mt-6 space-y-3 text-sm" style={{ color: "var(--text)" }}>
            {[
              "Free to start — no credit card",
              "₱300 minimum withdrawal",
              "10% referral commission forever",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <IconCheck size={16} style={{ color: "var(--success-fg)" }} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
          © 2026 Halvex Inc. · Minero
        </div>
      </aside>

      {/* ==================== Right: form ==================== */}
      <main className="flex flex-col px-4 py-8 lg:p-10">
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
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Create account</h1>
          <p className="text-sm mt-1 mb-6" style={{ color: "var(--text-muted)" }}>
            Start mining in under a minute.
          </p>

          {submitError && (
            <div className="alert alert-danger mb-4" role="alert">
              <IconError size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="name" className="input-label">Full name</label>
              <div className="relative">
                <IconUser
                  size={16}
                  style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                />
                <input
                  id="name"
                  className="input"
                  style={{ paddingLeft: 36 }}
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Juan dela Cruz"
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
              </div>
              {fieldErrors.name && (
                <p id="name-error" className="input-error" role="alert">{fieldErrors.name}</p>
              )}
            </div>
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
                <p id="email-error" className="input-error" role="alert">{fieldErrors.email}</p>
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
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : "pw-help"}
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
              {fieldErrors.password ? (
                <p id="password-error" className="input-error" role="alert">{fieldErrors.password}</p>
              ) : form.password.length > 0 ? (
                <div
                  id="pw-help"
                  className="flex items-center gap-1.5 mt-1.5 text-xs"
                  style={{ color: pwStrong ? "var(--success-fg)" : "var(--text-muted)" }}
                >
                  {pwStrong ? <IconCheck size={12} /> : <span aria-hidden>·</span>}
                  {pwStrong ? "Looks good" : "Minimum 8 characters"}
                </div>
              ) : null}
            </div>
            <div>
              <label htmlFor="referralCode" className="input-label">
                Referral code <span style={{ color: "var(--text-subtle)" }}>(optional)</span>
              </label>
              <div className="relative">
                <IconGift
                  size={16}
                  style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                />
                <input
                  id="referralCode"
                  className="input font-mono"
                  style={{ paddingLeft: 36 }}
                  type="text"
                  value={form.referralCode}
                  onChange={(e) => set("referralCode", e.target.value)}
                  placeholder="ABC123"
                  autoComplete="off"
                />
              </div>
            </div>
            <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
              {loading ? "Creating account…" : (
                <>
                  Create account <IconArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-5">
            <OAuthButtons referralCode={form.referralCode || undefined} />
          </div>

          <p className="text-xs text-center mt-4" style={{ color: "var(--text-subtle)" }}>
            By registering you agree to our{" "}
            <Link href="/terms" className="link-brand">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="link-brand">Privacy Policy</Link>.
          </p>
          <p className="text-center text-sm mt-3" style={{ color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" className="link-brand">Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
