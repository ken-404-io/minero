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
  IconError,
} from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function set(field: string, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
      } else {
        router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

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
          <h2 className="text-3xl font-bold tracking-tight">Welcome back.</h2>
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
      <main className="flex flex-col px-4 py-8 lg:p-10">
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
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm mt-1 mb-6" style={{ color: "var(--text-muted)" }}>
            Enter your credentials to continue.
          </p>

          {error && (
            <div className="alert alert-danger mb-4" role="alert">
              <IconError size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  required
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
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
                  required
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
            <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
              {loading ? "Signing in…" : (
                <>
                  Sign in <IconArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
            No account?{" "}
            <Link href="/register" className="link-brand">
              Register
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
