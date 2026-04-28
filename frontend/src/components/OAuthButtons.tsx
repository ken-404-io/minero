"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { getDeviceHash } from "@/lib/device";
import { IconGoogle } from "@/components/brand-icons";

type Props = {
  /** Optional referral code to carry through OAuth state. */
  referralCode?: string;
};

type ProviderInfo = { name: string; available: boolean };

const LABELS: Record<string, { name: string; Icon: typeof IconGoogle }> = {
  google: { name: "Google Account", Icon: IconGoogle },
};

const FALLBACK: ProviderInfo[] = [
  { name: "google", available: false },
];

export default function OAuthButtons({ referralCode }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/oauth/providers`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("not_ok");
        const data = (await res.json()) as { providers: ProviderInfo[] | string[] };
        // Back-compat: older deploys returned a plain string[].
        const list: ProviderInfo[] = Array.isArray(data.providers)
          ? data.providers
              .map((p) => (typeof p === "string" ? { name: p, available: true } : p))
              .filter((p) => p.name === "google")
          : FALLBACK;
        if (!cancelled && list.length > 0) setProviders(list);
      } catch {
        /* keep fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-subtle)" }}>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span>or continue with</span>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      <div className="flex flex-col gap-2">
        {providers.map((p) => {
          const meta = LABELS[p.name];
          if (!meta) return null;
          if (!p.available) {
            return (
              <button
                key={p.name}
                type="button"
                className="btn btn-secondary"
                disabled
                aria-disabled="true"
                title={`${meta.name} sign-in is not configured on this server`}
              >
                <meta.Icon size={18} style={{ opacity: 0.5 }} />
                <span>{meta.name}</span>
              </button>
            );
          }
          const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
            // Intercept the click so we can append the device fingerprint
            // to the URL — top-level navigations can't carry headers, and
            // the backend needs the hash to enforce one-account-per-device.
            e.preventDefault();
            const dh = await getDeviceHash();
            const params = new URLSearchParams();
            if (referralCode) params.set("ref", referralCode);
            if (dh) params.set("dh", dh);
            const qs = params.toString();
            window.location.href = `${API_URL}/auth/oauth/${p.name}${qs ? `?${qs}` : ""}`;
          };
          const fallbackHref =
            `${API_URL}/auth/oauth/${p.name}` +
            (referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "");
          return (
            <a
              key={p.name}
              href={fallbackHref}
              onClick={onClick}
              className="btn btn-secondary"
              aria-label={`Continue with ${meta.name}`}
            >
              <meta.Icon size={18} />
              <span>{meta.name}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
