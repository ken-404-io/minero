"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import { IconCheck } from "@/components/icons";

// PayMongo fires the webhook asynchronously, so the "paid" flag on the user
// may not be set the instant the browser lands here. Poll /auth/me briefly,
// then redirect regardless.
const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 8;

export default function SuccessClient() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick(n: number) {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { user?: { plan?: string } };
          if (data.user?.plan === "paid") {
            router.replace("/dashboard");
            return;
          }
        }
      } catch {
        /* swallow — will retry */
      }
      if (cancelled) return;
      if (n >= MAX_ATTEMPTS) {
        router.replace("/dashboard");
        return;
      }
      setAttempt(n + 1);
      timer = setTimeout(() => tick(n + 1), POLL_INTERVAL_MS);
    }

    tick(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div
        aria-hidden
        className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
        style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
      >
        <IconCheck size={28} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Payment received</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
        Activating your account… redirecting you to the dashboard.
      </p>
      <p className="mt-6 text-xs" style={{ color: "var(--text-subtle)" }}>
        Attempt {attempt + 1} of {MAX_ATTEMPTS + 1}
      </p>
    </div>
  );
}
