"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api-url";

export default function ReleaseCommissionsButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [approved, setApproved] = useState(0);

  async function release() {
    setState("loading");
    try {
      const res = await fetch(`${API_URL}/admin/referrals/approve?force=true`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { approved?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setApproved(data.approved ?? 0);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="text-sm" style={{ color: "var(--success-fg)" }}>
        ✓ Released {approved} commission{approved !== 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={release}
      disabled={state === "loading"}
      className="btn btn-secondary btn-sm"
      style={{ fontSize: "12px" }}
    >
      {state === "loading" ? "Releasing…" : state === "error" ? "Retry" : "Release pending commissions"}
    </button>
  );
}
