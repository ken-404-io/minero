"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    referralCode: searchParams.get("ref") ?? "",
  });
  const [error, setError] = useState<string | Record<string, string[]>>("");
  const [loading, setLoading] = useState(false);

  function set(field: string, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const errorStr = typeof error === "string" ? error : Object.values(error).flat().join(", ");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center text-2xl font-bold mb-8" style={{ color: "var(--gold)" }}>
          ⛏ Minero
        </Link>
        <div className="card">
          <h1 className="text-xl font-bold mb-6">Create Account</h1>
          {errorStr && (
            <div className="mb-4 px-3 py-2 rounded text-sm" style={{ background: "#2e0a0a", color: "#f87171" }}>
              {errorStr}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>Full Name</label>
              <input
                className="input"
                type="text"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Juan dela Cruz"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>Password</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--muted)" }}>Referral Code (optional)</label>
              <input
                className="input"
                type="text"
                value={form.referralCode}
                onChange={(e) => set("referralCode", e.target.value)}
                placeholder="e.g. ABC123"
                autoComplete="off"
              />
            </div>
            <button className="btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
          <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
            By registering you agree to our{" "}
            <Link href="/terms" className="hover:underline" style={{ color: "var(--gold)" }}>Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:underline" style={{ color: "var(--gold)" }}>Privacy Policy</Link>.
          </p>
          <p className="text-center text-sm mt-3" style={{ color: "var(--muted)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--gold)" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
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
