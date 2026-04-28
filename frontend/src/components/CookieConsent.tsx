"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "minero_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage blocked (private browsing edge case) — don't show banner.
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="mx-auto max-w-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 rounded-xl p-4 sm:p-5 shadow-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          pointerEvents: "auto",
        }}
      >
        <p className="flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
          We use cookies for authentication and, on the free plan, ad networks may set
          their own cookies. See our{" "}
          <Link href="/privacy" className="link-brand underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <button
          onClick={accept}
          className="btn btn-primary btn-sm shrink-0 w-full sm:w-auto"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
