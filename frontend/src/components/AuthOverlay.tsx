"use client";

import { useEffect } from "react";

type Props = {
  mode: "in" | "out";
};

export default function AuthOverlay({ mode }: Props) {
  // Lock scroll while the overlay is visible.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const label = mode === "in" ? "Signing in" : "Signing out";
  const sub =
    mode === "in"
      ? "Preparing your dashboard"
      : "See you soon";

  return (
    <div
      className="auth-overlay"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="auth-overlay-spinner" aria-hidden />
      <span className="auth-overlay-label">
        {label}
        <span className="auth-overlay-dot" aria-hidden />
        <span className="auth-overlay-dot" aria-hidden />
        <span className="auth-overlay-dot" aria-hidden />
      </span>
      <span className="auth-overlay-sub">{sub}</span>
    </div>
  );
}
