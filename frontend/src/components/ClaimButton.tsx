"use client";

import { useState, useEffect } from "react";
import { CLAIM_INTERVAL_MS } from "@/lib/mining";
import { API_URL } from "@/lib/api-url";
import { deviceHeaders } from "@/lib/device";
import AdViewer from "@/components/AdViewer";
import { IconPickaxe, IconClock, IconCheck, IconError, IconBoltSmall } from "@/components/icons";

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

const RING_SIZE = 232;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export default function ClaimButton({
  lastClaimAt,
  dailyEarned,
  dailyCap,
  ratePerClaim,
  onClaim,
}: Props) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [flash, setFlash] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [adSession, setAdSession] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdown = lastClaimAt
    ? Math.max(0, CLAIM_INTERVAL_MS - (now - new Date(lastClaimAt).getTime()))
    : 0;

  const capReached = dailyEarned >= dailyCap;
  const canClaim = countdown === 0 && !capReached;
  const dailyProgress = Math.min(100, (dailyEarned / dailyCap) * 100);
  const cooldownProgress = lastClaimAt
    ? Math.max(0, Math.min(1, (CLAIM_INTERVAL_MS - countdown) / CLAIM_INTERVAL_MS))
    : 1;
  const ringOffset = RING_CIRC * (1 - cooldownProgress);

  function openAd() {
    if (!canClaim || claiming) return;
    setFlash(null);
    setAdSession(Date.now());
  }

  async function submitClaim(adToken: string) {
    setClaiming(true);
    try {
      const res = await fetch(`${API_URL}/claim`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(await deviceHeaders()) },
        body: JSON.stringify({ adToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setFlash({ kind: "success", text: `+₱${data.amount.toFixed(4)} claimed` });
        onClaim(data.amount, new Date(data.nextClaimAt));
        setTimeout(() => setFlash(null), 3000);
      } else {
        const msg = typeof data.error === "string" ? data.error : "Claim failed";
        setFlash({ kind: "error", text: msg });
      }
    } catch {
      setFlash({ kind: "error", text: "Network error" });
    } finally {
      setClaiming(false);
      setAdSession(null);
    }
  }

  const liveMessage = canClaim
    ? `Ready to claim ₱${ratePerClaim}`
    : capReached
    ? "Daily cap reached"
    : `Next claim in ${formatCountdown(countdown)}`;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Live region for screen readers */}
      <div className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </div>

      {/* Claim ring + button */}
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          className="absolute inset-0"
          aria-hidden
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="var(--surface-2)"
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={canClaim ? "var(--brand)" : "var(--brand-weak-fg)"}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={ringOffset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>

        <button
          onClick={openAd}
          disabled={!canClaim || claiming}
          aria-label={
            capReached
              ? "Daily cap reached"
              : canClaim
              ? `Claim ₱${ratePerClaim}`
              : `Wait ${formatCountdown(countdown)}`
          }
          className={`absolute inset-[14px] rounded-full flex flex-col items-center justify-center gap-1 font-semibold ${
            canClaim ? "claim-pulse" : ""
          }`}
          style={{
            background: canClaim ? "var(--brand)" : "var(--surface-2)",
            color: canClaim ? "var(--brand-fg)" : "var(--text-muted)",
            border: `1px solid ${canClaim ? "var(--brand-hover)" : "var(--border)"}`,
            cursor: canClaim ? "pointer" : "not-allowed",
            transition: "background 200ms var(--ease-out), color 200ms var(--ease-out)",
          }}
        >
          {canClaim ? (
            <>
              <IconPickaxe size={32} />
              <span className="text-base tracking-wide">
                {claiming ? "CLAIMING…" : "CLAIM"}
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--brand-fg)", opacity: 0.75 }}>
                ₱{ratePerClaim.toFixed(3)}
              </span>
            </>
          ) : capReached ? (
            <>
              <IconCheck size={28} />
              <span className="text-sm">Daily cap</span>
              <span className="text-xs" style={{ color: "var(--text-subtle)" }}>reached</span>
            </>
          ) : (
            <>
              <IconClock size={24} />
              <span className="text-2xl font-mono font-bold tabular-nums" style={{ color: "var(--brand)" }}>
                {formatCountdown(countdown)}
              </span>
              <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-subtle)" }}>
                next claim
              </span>
            </>
          )}
        </button>
      </div>

      {/* Flash toast */}
      {flash && (
        <div
          role="status"
          aria-live="polite"
          className={`alert ${flash.kind === "success" ? "alert-success" : "alert-danger"}`}
        >
          {flash.kind === "success" ? <IconCheck size={16} /> : <IconError size={16} />}
          <span>{flash.text}</span>
        </div>
      )}

      {/* Daily progress */}
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: "var(--text-muted)" }} className="flex items-center gap-1">
            <IconBoltSmall size={12} />
            Today&apos;s earnings
          </span>
          <span className="font-mono tabular-nums" style={{ color: "var(--text)" }}>
            ₱{dailyEarned.toFixed(4)}
            <span style={{ color: "var(--text-subtle)" }}> / ₱{dailyCap}</span>
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(dailyProgress)} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`progress-bar ${capReached ? "is-success" : ""}`}
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
      </div>

      {adSession !== null && (
        <AdViewer
          key={adSession}
          onClose={() => setAdSession(null)}
          onVerified={(token) => void submitClaim(token)}
        />
      )}
    </div>
  );
}
