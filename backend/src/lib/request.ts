import type { Context } from "hono";
import type { IncomingMessage } from "node:http";

export function getClientIp(c: Context): string {
  // Prefer forwarded headers set by a reverse proxy.
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;
  // Fall back to the raw TCP socket address (available with @hono/node-server).
  const incoming = (c.env as { incoming?: IncomingMessage })?.incoming;
  const remoteAddress = incoming?.socket?.remoteAddress;
  return remoteAddress ?? "unknown";
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

/** Returns true when the IP cannot reliably identify a single physical device
 *  (loopback in dev, or missing forwarding headers behind some proxies). */
export function isUntrackableIp(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  if (LOOPBACK.has(ip)) return true;
  if (ip.startsWith("::ffff:127.")) return true;
  return false;
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
