import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { verifySession, type SessionPayload } from "./auth.js";
import { prisma } from "./db.js";
import { isActivated } from "./config.js";

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

/**
 * Middleware that blocks users whose plan is not "paid". Responds with
 * 402 Payment Required and a redirect hint. Admins bypass the paywall.
 * Must run after sessionMiddleware.
 */
export const requireActivated: MiddlewareHandler = async (c, next) => {
  const s = c.get("session");
  if (!s) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (s.role === "admin") {
    await next();
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { plan: true, frozen: true },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);
  if (!isActivated(user.plan)) {
    return c.json({ error: "payment_required", redirectTo: "/activate" }, 402);
  }
  await next();
};

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
