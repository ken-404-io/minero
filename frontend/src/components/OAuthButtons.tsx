"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { IconGoogle, IconFacebook } from "@/components/brand-icons";

type Props = {
  /** Optional referral code to carry through OAuth state. */
  referralCode?: string;
};

const LABELS: Record<string, { name: string; Icon: typeof IconGoogle }> = {
  google: { name: "Google", Icon: IconGoogle },
  facebook: { name: "Facebook", Icon: IconFacebook },
};

export default function OAuthButtons({ referralCode }: Props) {
  const [providers, setProviders] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/oauth/providers`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("not_ok");
        const data = (await res.json()) as { providers: string[] };
        if (!cancelled) setProviders(data.providers);
      } catch {
        if (!cancelled) setProviders([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Hide entirely if backend hasn't responded or no providers are configured
  if (providers === null || providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-subtle)" }}>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span>or continue with</span>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
        {providers.map((p) => {
          const meta = LABELS[p];
          if (!meta) return null;
          const href =
            `${API_URL}/auth/oauth/${p}` +
            (referralCode ? `?ref=${encodeURIComponent(referralCode)}` : "");
          return (
            <a
              key={p}
              href={href}
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
