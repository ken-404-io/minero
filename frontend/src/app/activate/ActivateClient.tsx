"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api-url";
import {
  IconCheck,
  IconError,
  IconArrowRight,
  IconShield,
} from "@/components/icons";

type Props = {
  userName: string;
  cancelled: boolean;
};

export default function ActivateClient({ userName, cancelled }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/plans/pay-signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok || !data?.redirectUrl) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not start payment. Please try again.",
        );
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 lg:px-8 py-10">
      <header className="mb-6">
        <span className="section-title">Remove Ads</span>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          Go ad-free for life
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          Hi {userName} — pay once to remove all ads from your account. No
          subscriptions, no recurring charges.
        </p>
      </header>

      {cancelled && (
        <div className="alert alert-warning mb-4" role="status">
          <IconError size={16} />
          <span>Payment cancelled. You can try again below.</span>
        </div>
      )}

      <section
        className="card"
        style={{ background: "var(--bg-elevated)", padding: "1.5rem" }}
      >
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            One-time fee
          </span>
          <span className="text-4xl font-bold" style={{ color: "var(--brand)" }}>
            ₱49.00
          </span>
        </div>

        <ul className="space-y-2 text-sm mb-5">
          <li className="flex items-start gap-2">
            <IconCheck
              size={16}
              style={{ color: "var(--success-fg)" }}
              className="mt-0.5 shrink-0"
            />
            <span>Permanently removes all ads from your account</span>
          </li>
          <li className="flex items-start gap-2">
            <IconCheck
              size={16}
              style={{ color: "var(--success-fg)" }}
              className="mt-0.5 shrink-0"
            />
            <span>Pay via GCash, Maya, or card (PayMongo)</span>
          </li>
          <li className="flex items-start gap-2">
            <IconCheck
              size={16}
              style={{ color: "var(--success-fg)" }}
              className="mt-0.5 shrink-0"
            />
            <span>Ads removed the moment payment confirms</span>
          </li>
        </ul>

        {error && (
          <div className="alert alert-danger mb-4" role="alert">
            <IconError size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={submitting}
          className="btn btn-primary btn-lg w-full"
        >
          {submitting ? (
            "Redirecting to checkout…"
          ) : (
            <>
              Remove ads for ₱49
              <IconArrowRight size={18} />
            </>
          )}
        </button>

        <p
          className="text-xs mt-4 flex items-start gap-2"
          style={{ color: "var(--text-subtle)" }}
        >
          <IconShield size={14} className="mt-0.5 shrink-0" />
          <span>
            Payments are processed securely by PayMongo. Minero never sees
            your card or wallet credentials.
          </span>
        </p>
      </section>
    </div>
  );
}
