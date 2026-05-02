"use client";

import { useState, useTransition } from "react";
import { approveReferralCommissions } from "./actions";

export default function ReleaseCommissionsButton({ pendingCount }: { pendingCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ approved: number } | { error: string } | null>(null);

  function release() {
    startTransition(async () => {
      const r = await approveReferralCommissions();
      setResult(r);
    });
  }

  if (result && "approved" in result) {
    return (
      <span className="text-sm" style={{ color: "var(--success-fg)" }}>
        ✓ Released {result.approved} commission{result.approved !== 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {result && "error" in result && (
        <span className="text-xs" style={{ color: "var(--danger-fg)" }}>{result.error}</span>
      )}
      <button
        type="button"
        onClick={release}
        disabled={isPending || pendingCount === 0}
        className="btn btn-secondary btn-sm"
        style={{ fontSize: "12px" }}
      >
        {isPending
          ? "Releasing…"
          : result && "error" in result
          ? "Retry"
          : `Release ${pendingCount} pending commission${pendingCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
