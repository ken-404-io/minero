import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { verifySession, type SessionPayload } from "./auth.js";

declare module "hono" {
  interface ContextVariableMap {
    session?: SessionPayload;
  }
}

const COOKIE_NAME = "session";

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    const payload = await verifySession(token);
    if (payload) c.set("session", payload);
  }
  await next();
};

export function requireAuth(c: Context): SessionPayload | Response {
  const s = c.get("session");
  if (!s) return c.json({ error: "Unauthorized" }, 401);
  return s;
}

export function requireAdmin(c: Context): SessionPayload | Response {
  const s = c.get("session");
  if (!s) return c.json({ error: "Unauthorized" }, 401);
  if (s.role !== "admin") return c.json({ error: "Forbidden" }, 403);
  return s;
}

function sessionCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    domain,
  };
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(c: Context) {
  const opts = sessionCookieOptions();
  deleteCookie(c, COOKIE_NAME, { path: opts.path, domain: opts.domain });
}
