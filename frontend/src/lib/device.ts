"use client";

// Lightweight device fingerprint. Not a strong anti-fraud primitive on
// its own — just enough signal to cluster signups from the same browser.
// Real fraud work pairs this with server-side ASN/IP reputation.

const STORAGE_KEY = "minero_device_hash";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "nocanvas";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 220, 40);
    ctx.fillStyle = "#069";
    ctx.fillText("minero-fingerprint", 2, 2);
    return canvas.toDataURL().slice(0, 120);
  } catch {
    return "nocanvas";
  }
}

async function computeFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";
  const nav = window.navigator;
  const parts = [
    nav.userAgent,
    nav.language,
    (nav.languages ?? []).join(","),
    String(nav.hardwareConcurrency ?? ""),
    String((nav as { deviceMemory?: number }).deviceMemory ?? ""),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(new Date().getTimezoneOffset()),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    canvasFingerprint(),
  ];
  return await sha256Hex(parts.join("|"));
}

/** Returns a stable device hash for the current browser. Persists in
 *  localStorage so repeated visits map to the same hash. */
export async function getDeviceHash(): Promise<string> {
  if (typeof window === "undefined") return "";
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && /^[a-f0-9]{16,128}$/.test(cached)) return cached;
  } catch { /* localStorage may be blocked */ }
  const hash = await computeFingerprint();
  try { localStorage.setItem(STORAGE_KEY, hash); } catch { /* ignore */ }
  return hash;
}

/** Headers to attach to any backend request so server-side fraud
 *  detection has the fingerprint. */
export async function deviceHeaders(): Promise<Record<string, string>> {
  const hash = await getDeviceHash();
  return hash ? { "X-Device-Hash": hash } : {};
}
