"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";
import { deviceHeaders } from "@/lib/device";
import { IconX, IconCheck, IconClock, IconError, IconBoltSmall } from "@/components/icons";

type Stage = "loading" | "playing" | "verifying" | "ready" | "error";

type Props = {
  onClose: () => void;
  onVerified: (token: string) => void;
};

/**
 * Ad viewer overlay. The parent mounts this fresh each session (via
 * `key`) and unmounts when the flow is done — so we don't need an
 * explicit reset effect.
 *
 * In production this wraps the ad network's SDK. The mock provider
 * accepts any verify call after minViewDurationMs has elapsed.
 */
export default function AdViewer({ onClose, onVerified }: Props) {
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [minDuration, setMinDuration] = useState(5000);

  useEffect(() => {
    let cancelled = false;
    let tickId: ReturnType<typeof setInterval> | null = null;

    async function run() {
      // 1. issue token
      let token: string;
      let minMs: number;
      try {
        const res = await fetch(`${API_URL}/ad/view-start`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...(await deviceHeaders()) },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "ad_unavailable");
        if (cancelled) return;
        token = data.token;
        minMs = data.minViewDurationMs ?? 5000;
        setMinDuration(minMs);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load ad");
        setStage("error");
        return;
      }

      // 2. play + tick progress
      setStage("playing");
      const start = Date.now();
      await new Promise<void>((resolve) => {
        tickId = setInterval(() => {
          if (cancelled) { resolve(); return; }
          const elapsed = Date.now() - start;
          setProgress(Math.min(100, (elapsed / minMs) * 100));
          if (elapsed >= minMs) {
            if (tickId) clearInterval(tickId);
            resolve();
          }
        }, 100);
      });
      if (cancelled) return;

      // 3. verify with backend
      setStage("verifying");
      try {
        const elapsedMs = Date.now() - start;
        const res = await fetch(`${API_URL}/ad/view-complete`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...(await deviceHeaders()) },
          body: JSON.stringify({ token, elapsedMs }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "verification_failed");
          setStage("error");
          return;
        }
        setStage("ready");
        onVerified(token);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Verification failed");
        setStage("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (tickId) clearInterval(tickId);
    };
  }, [onVerified]);

  // Lock body scroll while mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      <div className="sheet-scrim" aria-hidden />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-viewer-title"
      >
        <div className="sheet-handle" aria-hidden />

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <span className="section-title">Sponsored</span>
            <h2 id="ad-viewer-title" className="text-lg font-semibold mt-1">
              {stage === "ready" ? "Thanks for watching" : "Watch an ad to claim"}
            </h2>
          </div>
          {(stage === "error" || stage === "ready") && (
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <IconX size={18} />
            </button>
          )}
        </div>

        <div
          className="surface-2 aspect-video w-full flex items-center justify-center mb-4 relative overflow-hidden"
          style={{ borderRadius: "var(--radius-lg)" }}
          aria-hidden={stage !== "playing"}
        >
          <div
            className="flex flex-col items-center gap-2"
            style={{ color: "var(--text-muted)" }}
          >
            <IconBoltSmall size={36} />
            <div className="text-sm font-medium">
              {stage === "loading" && "Loading ad…"}
              {stage === "playing" && "Ad is playing"}
              {stage === "verifying" && "Verifying view…"}
              {stage === "ready" && "Ad verified"}
              {stage === "error" && "Ad failed to load"}
            </div>
            {stage === "playing" && (
              <div className="text-xs tabular-nums">
                {Math.max(0, Math.ceil((minDuration * (1 - progress / 100)) / 1000))}s remaining
              </div>
            )}
          </div>

          {stage === "playing" && (
            <div
              className="absolute left-0 bottom-0 h-1"
              style={{
                width: `${progress}%`,
                background: "var(--brand)",
                transition: "width 120ms linear",
              }}
            />
          )}
        </div>

        {stage === "error" && (
          <div className="alert alert-danger mb-4" role="alert">
            <IconError size={16} />
            <span>{error ?? "Something went wrong"}</span>
          </div>
        )}

        {stage === "verifying" && (
          <div className="alert alert-info mb-4" role="status">
            <IconClock size={16} />
            <span>Verifying that you watched the full ad…</span>
          </div>
        )}

        {stage === "ready" && (
          <div className="alert alert-success mb-4" role="status">
            <IconCheck size={16} />
            <span>Submitting claim…</span>
          </div>
        )}

        {stage === "error" && (
          <button onClick={onClose} className="btn btn-secondary w-full">
            Close
          </button>
        )}
      </div>
    </>
  );
}
