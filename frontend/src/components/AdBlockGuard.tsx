"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconShield, IconWarning } from "@/components/icons";

// Triggers used by adblock filter lists. uBlock/AdBlock/AdGuard hide or strip
// elements matching any of these; if the bait survives intact, no client-side
// blocker is munging the DOM.
const BAIT_CLASSES = [
  "ad",
  "ads",
  "adsbox",
  "ad-banner",
  "ad-placement",
  "adsbygoogle",
  "doubleclick",
  "pub_300x250",
  "textads",
  "banner-ads",
  "carbon-ads",
  "sponsored",
].join(" ");

// URLs hit by the platform's actual ad pipeline (Monetag) plus the most
// common third-party ad endpoints. DNS-level blockers (Pi-hole, AdGuard DNS,
// NextDNS, private DNS) refuse to resolve these hostnames, so an Image probe
// fires onerror well within the timeout. Browser blockers cancel the request.
const PROBE_URLS = [
  "https://ueuee.com/tag.min.js",
  "https://5gvci.com/act/files/tag.min.js",
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
  "https://www.googletagservices.com/tag/js/gpt.js",
];

const PROBE_TIMEOUT_MS = 3500;
const RECHECK_DEBOUNCE_MS = 600;

// Fire one probe per URL. Resolves to `true` if the URL is reachable from this
// browser (no client blocker, no DNS blackhole), `false` if blocked.
function probeUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    // Image-based probe — works regardless of CORS and across all browsers.
    // A blocked URL fires `error`; a blackholed DNS lookup also lands here.
    // The cache-buster guarantees we don't get a stale 200 from a previous
    // visit before the user enabled their blocker.
    const img = new Image();
    const bust = `?_=${Date.now()}-${Math.random().toString(36).slice(2)}`;
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url + bust;

    window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS);
  });
}

// Inject a hidden bait element with classnames every popular filter list
// targets, give the blocker a tick to act, then read computed styles. Any of
// `display:none`, zero box, or `offsetParent === null` indicates the element
// was hidden by an injected stylesheet.
async function detectByBait(): Promise<boolean> {
  const bait = document.createElement("div");
  bait.className = BAIT_CLASSES;
  bait.setAttribute("aria-hidden", "true");
  bait.style.cssText =
    "position:absolute!important;top:-9999px!important;left:-9999px!important;" +
    "width:5px!important;height:5px!important;pointer-events:none!important;" +
    "opacity:0.01!important;";
  bait.innerHTML = "&nbsp;";
  document.body.appendChild(bait);

  // Two animation frames — gives content blockers time to apply hide rules.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 80));

  const cs = window.getComputedStyle(bait);
  const blocked =
    !document.body.contains(bait) ||
    bait.offsetParent === null ||
    bait.offsetHeight === 0 ||
    bait.clientHeight === 0 ||
    cs.display === "none" ||
    cs.visibility === "hidden";

  if (document.body.contains(bait)) {
    document.body.removeChild(bait);
  }
  return blocked;
}

type DetectionState = "checking" | "clear" | "blocked";

export default function AdBlockGuard() {
  const [state, setState] = useState<DetectionState>("checking");
  const [recheckBusy, setRecheckBusy] = useState(false);
  const runId = useRef(0);

  const runDetection = useCallback(async () => {
    const myRun = ++runId.current;

    // Start the bait check and probes in parallel — they're independent.
    const [baitBlocked, probeResults] = await Promise.all([
      detectByBait(),
      Promise.all(PROBE_URLS.map(probeUrl)),
    ]);

    if (myRun !== runId.current) return; // a newer run superseded this one

    const reachable = probeResults.filter(Boolean).length;
    // If every ad-network probe failed, treat as blocked (DNS or client).
    // We tolerate one transient failure to avoid false positives on flaky
    // networks — but two or more failures *plus* the bait check are damning.
    const allProbesBlocked = reachable === 0;
    const mostProbesBlocked = reachable <= 1;

    const blocked = baitBlocked || allProbesBlocked || (mostProbesBlocked && baitBlocked);
    setState(blocked ? "blocked" : "clear");
  }, []);

  useEffect(() => {
    runDetection();
  }, [runDetection]);

  // When the modal is up, freeze the page underneath so the user can't
  // continue interacting with the rewards UI while ads are blocked.
  useEffect(() => {
    if (state !== "blocked") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [state]);

  const onRecheck = useCallback(async () => {
    if (recheckBusy) return;
    setRecheckBusy(true);
    setState("checking");
    await new Promise((r) => setTimeout(r, RECHECK_DEBOUNCE_MS));
    await runDetection();
    setRecheckBusy(false);
  }, [recheckBusy, runDetection]);

  if (state !== "blocked") return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="adblock-title"
      aria-describedby="adblock-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{
        background: "color-mix(in oklab, var(--bg) 92%, transparent)",
        backdropFilter: "saturate(1.2) blur(14px)",
        WebkitBackdropFilter: "saturate(1.2) blur(14px)",
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-6 sm:p-8"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--danger-weak)",
              color: "var(--danger-fg)",
            }}
          >
            <IconShield size={26} />
          </span>
          <div className="min-w-0">
            <h2
              id="adblock-title"
              className="text-xl sm:text-2xl font-bold tracking-tight"
            >
              Ad blocker detected
            </h2>
            <p
              id="adblock-desc"
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Minero is free because advertisers pay us — and we pay you. To keep
              earning, please disable any tools that block ads on this site and
              reload.
            </p>
          </div>
        </div>

        <ul
          className="mt-5 space-y-2 text-sm rounded-lg p-4"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          {[
            "Browser ad blockers (uBlock Origin, AdBlock, AdGuard, Brave Shields)",
            "DNS-level blockers (Pi-hole, AdGuard DNS, NextDNS)",
            "Private DNS profiles set in Android / iOS settings",
            "VPNs or browsers with built-in ad filtering",
          ].map((label) => (
            <li key={label} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--danger-weak)",
                  color: "var(--danger-fg)",
                }}
              >
                <IconWarning size={11} />
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div
          className="mt-5 rounded-lg p-3 text-xs"
          style={{
            background: "var(--brand-weak)",
            color: "var(--brand-weak-fg)",
            border: "1px solid color-mix(in oklab, var(--brand) 30%, transparent)",
          }}
        >
          <strong className="font-semibold">Tip:</strong> Allow{" "}
          <span className="font-mono">minero</span> in your blocker, switch off
          private DNS, then tap recheck below.
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <a
            href="https://help.minero.ph/disable-adblock"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-md"
          >
            How to disable
          </a>
          <button
            type="button"
            onClick={onRecheck}
            disabled={recheckBusy}
            className="btn btn-primary btn-md"
            aria-busy={recheckBusy}
          >
            {recheckBusy ? "Checking…" : "I've disabled it — recheck"}
          </button>
        </div>
      </div>
    </div>
  );
}
