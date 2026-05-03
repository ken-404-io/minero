"use client";

import { useState } from "react";
import { IconInfo, IconX } from "@/components/icons";

export default function AnnouncementBanner({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (!message || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
      style={{
        background: "var(--brand-weak)",
        borderBottom: "1px solid var(--brand)",
        color: "var(--brand)",
      }}
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <IconInfo size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        <span className="whitespace-pre-line">{message}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="btn-icon shrink-0"
        style={{ color: "var(--brand)" }}
      >
        <IconX size={15} />
      </button>
    </div>
  );
}
