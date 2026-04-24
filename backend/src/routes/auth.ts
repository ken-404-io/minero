import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db.js";
import { createSession, generateReferralCode } from "../lib/auth.js";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
} from "../lib/session.js";
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  clearRefreshCookie,
  setRefreshCookie,
  readRefreshCookie,
} from "../lib/refresh.js";
import { getConfig } from "../lib/config.js";
import { getClientIp, getDeviceHash } from "../lib/request.js";
import { raiseAlert } from "../lib/fraud.js";
import { rateLimit } from "../lib/rateLimit.js";

export const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (c) => {
  const ip = getClientIp(c);
  // 10 login attempts per IP per 15 minutes to stop brute-force.
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    c.header("Retry-After", String(Math.ceil(rl.retryAfterMs / 1000)));
    return c.json({ error: "Too many login attempts. Try again later." }, 429);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Invalid credentials" }, 400);

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.hash("dummy", 12);
    return c.json({ error: "Invalid credentials" }, 401);
  }
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  if (!user.passwordHash) {
    // OAuth-only account — no password set.
    return c.json(
      { error: `This account uses ${user.authProvider ?? "another provider"} sign-in` },
      400,
    );
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const token = await createSession({ userId: user.id, role: user.role });
  setSessionCookie(c, token);

  const refresh = await issueRefreshToken({
    userId: user.id,
    ip,
    userAgent: c.req.header("user-agent") ?? null,
  });
  setRefreshCookie(c, refresh.token);

  const deviceHash = getDeviceHash(c);
  if (deviceHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastDeviceHash: deviceHash },
    });
  }

  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

const registerSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
});

authRoutes.post("/register", async (c) => {
  const ip = getClientIp(c);
  // 5 registrations per IP per hour to prevent mass account creation.
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    c.header("Retry-After", String(Math.ceil(rl.retryAfterMs / 1000)));
    return c.json({ error: "Too many accounts created from this IP. Try again later." }, 429);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { name, email, password, referralCode } = parsed.data;
  const deviceHash = getDeviceHash(c);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return c.json({ error: "Email already registered" }, 409);

  let referrerId: string | undefined;
  let referralIgnoredReason: string | null = null;

  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true, frozen: true },
    });

    if (!referrer || referrer.frozen) {
      referralIgnoredReason = "referrer_unavailable";
    } else {
      const cfg = await getConfig();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayReferrals = await prisma.referral.count({
        where: { referrerId: referrer.id, createdAt: { gte: startOfDay } },
      });
      if (todayReferrals >= cfg.maxReferralsPerDay) {
        referralIgnoredReason = "daily_cap";
        await raiseAlert({
          userId: referrer.id,
          type: "referral_cap_hit",
          severity: "low",
          details: { attemptedBy: email, todayReferrals },
        });
      } else {
        const dupeConditions: object[] = [];
        if (deviceHash) dupeConditions.push({ signupDevice: deviceHash });
        if (ip && ip !== "unknown") dupeConditions.push({ signupIp: ip });

        const dupe =
          dupeConditions.length > 0
            ? await prisma.user.findFirst({
                where: { OR: dupeConditions },
                select: { id: true },
              })
            : null;

        if (dupe) {
          referralIgnoredReason = "duplicate_account";
          await raiseAlert({
            userId: referrer.id,
            type: "multi_account_signup",
            severity: "high",
            details: { attemptedBy: email, existingUserId: dupe.id, ip, deviceHash },
          });
        } else {
          referrerId = referrer.id;
        }
      }
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let code = generateReferralCode();
  while (await prisma.user.findUnique({ where: { referralCode: code } })) {
    code = generateReferralCode();
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      referralCode: code,
      referredBy: referrerId,
      signupIp: ip === "unknown" ? null : ip,
      signupDevice: deviceHash,
      lastDeviceHash: deviceHash,
    },
  });

  if (referrerId) {
    await prisma.referral.create({ data: { referrerId, referralId: user.id } });
  }

  const token = await createSession({ userId: user.id, role: user.role });
  setSessionCookie(c, token);
  const refresh = await issueRefreshToken({
    userId: user.id,
    ip,
    userAgent: c.req.header("user-agent") ?? null,
  });
  setRefreshCookie(c, refresh.token);

  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    referralApplied: !!referrerId,
    referralIgnoredReason,
  });
});

authRoutes.post("/logout", async (c) => {
  const rt = readRefreshCookie(c);
  if (rt) await revokeRefreshToken(rt);
  clearSessionCookie(c);
  clearRefreshCookie(c);
  return c.json({ ok: true });
});

authRoutes.post("/refresh", async (c) => {
  const rt = readRefreshCookie(c);
  if (!rt) return c.json({ error: "Missing refresh token" }, 401);

  const rotated = await rotateRefreshToken({
    token: rt,
    ip: getClientIp(c),
    userAgent: c.req.header("user-agent") ?? null,
  });
  if (!rotated.ok) {
    clearSessionCookie(c);
    clearRefreshCookie(c);
    return c.json({ error: rotated.reason }, 401);
  }

  const access = await createSession({ userId: rotated.userId, role: rotated.role });
  setSessionCookie(c, access);
  setRefreshCookie(c, rotated.token);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      balance: true,
      pendingBalance: true,
      plan: true,
      referralCode: true,
      role: true,
      frozen: true,
      createdAt: true,
    },
  });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ user });
});
