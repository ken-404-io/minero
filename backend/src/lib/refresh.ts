import crypto from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { prisma } from "./db.js";

const COOKIE_NAME = "refresh_token";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function cookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
    domain,
  };
}

export function setRefreshCookie(c: Context, token: string) {
  setCookie(c, COOKIE_NAME, token, cookieOptions());
}

export function readRefreshCookie(c: Context): string | undefined {
  return getCookie(c, COOKIE_NAME);
}

export function clearRefreshCookie(c: Context) {
  const opts = cookieOptions();
  deleteCookie(c, COOKIE_NAME, { path: opts.path, domain: opts.domain });
}

function newToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export async function issueRefreshToken(params: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const token = newToken();
  const rec = await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      token,
      expiresAt: new Date(Date.now() + TTL_MS),
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
  return { token, expiresAt: rec.expiresAt };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function rotateRefreshToken(params: {
  token: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<
  | { ok: true; token: string; userId: string; role: string }
  | { ok: false; reason: string }
> {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: params.token },
    include: { user: { select: { id: true, role: true, frozen: true } } },
  });
  if (!existing) return { ok: false, reason: "invalid" };
  if (existing.revokedAt) return { ok: false, reason: "revoked" };
  if (existing.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (existing.user.frozen) return { ok: false, reason: "frozen" };

  const token = newToken();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        token,
        expiresAt: new Date(Date.now() + TTL_MS),
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    }),
  ]);

  return { ok: true, token, userId: existing.user.id, role: existing.user.role };
}
