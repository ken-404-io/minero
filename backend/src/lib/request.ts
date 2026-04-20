import type { Context } from "hono";

export function getClientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

const DEVICE_HASH_RE = /^[a-f0-9]{16,128}$/i;

export function getDeviceHash(c: Context): string | null {
  const raw =
    c.req.header("x-device-hash") ??
    c.req.header("x-device-fingerprint") ??
    null;
  if (!raw) return null;
  if (!DEVICE_HASH_RE.test(raw)) return null;
  return raw.toLowerCase();
}
