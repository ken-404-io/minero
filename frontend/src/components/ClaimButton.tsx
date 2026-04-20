"use client";

import { useState, useEffect, useCallback } from "react";
import { CLAIM_INTERVAL_MS } from "@/lib/mining";
import { API_URL } from "@/lib/api-url";

type Props = {
  lastClaimAt: Date | null;
  dailyEarned: number;
  dailyCap: number;
  ratePerClaim: number;
  onClaim: (amount: number, nextClaimAt: Date) => void;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function ClaimButton({ lastClaimAt, dailyEarned, dailyCap, ratePerClaim, onClaim }: Props) {
  const [countdown, setCountdown] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const getRemaining = useCallback(() => {
    if (!lastClaimAt) return 0;
    const elapsed = Date.now() - new Date(lastClaimAt).getTime();
    return Math.max(0, CLAIM_INTERVAL_MS - elapsed);
  }, [lastClaimAt]);

  useEffect(() => {
    setCountdown(getRemaining());
    const id = setInterval(() => {
      setCountdown(getRemaining());
    }, 1000);
    return () => clearInterval(id);
  }, [getRemaining]);

  const canClaim = countdown === 0 && dailyEarned < dailyCap;
  const progress = Math.min(100, (dailyEarned / dailyCap) * 100);

  async function handleClaim() {
    if (!canClaim || claiming) return;
    setClaiming(true);
    setFlash(null);
    try {
      const res = await fetch(`${API_URL}/claim`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setFlash(`+₱${data.amount.toFixed(4)} claimed!`);
        onClaim(data.amount, new Date(data.nextClaimAt));
        setTimeout(() => setFlash(null), 3000);
      } else {
        setFlash(data.error || "Claim failed");
      }
    } catch {
      setFlash("Network error");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Big claim button */}
      <div className="relative">
        <button
          onClick={handleClaim}
          disabled={!canClaim || claiming}
          className="w-48 h-48 rounded-full text-lg font-bold transition-all border-4 flex flex-col items-center justify-center gap-1"
          style={{
            background: canClaim ? "var(--gold)" : "var(--surface-2)",
            color: canClaim ? "#000" : "var(--muted)",
            borderColor: canClaim ? "var(--gold-light)" : "var(--border)",
            boxShadow: canClaim ? "0 0 40px rgba(245,158,11,0.4)" : "none",
            cursor: canClaim ? "pointer" : "not-allowed",
          }}
        >
          <span className="text-4xl">{canClaim ? "⛏" : "⏱"}</span>
          <span>{canClaim ? (claiming ? "Claiming…" : "CLAIM") : "WAIT"}</span>
          {!canClaim && countdown > 0 && (
            <span className="text-2xl font-mono font-bold" style={{ color: "var(--gold)" }}>
              {formatCountdown(countdown)}
            </span>
          )}
          {dailyEarned >= dailyCap && (
            <span className="text-xs">Daily cap reached</span>
          )}
        </button>
      </div>

      {/* Flash message */}
      {flash && (
        <div
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={
            flash.startsWith("+")
              ? { background: "#0a2e1a", color: "#34d399" }
              : { background: "#2e0a0a", color: "#f87171" }
          }
        >
          {flash}
        </div>
      )}

      {/* Daily progress */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted)" }}>
          <span>Today&apos;s Earnings</span>
          <span>₱{dailyEarned.toFixed(4)} / ₱{dailyCap}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: "var(--gold)" }}
          />
        </div>
      </div>
    </div>
  );
}
