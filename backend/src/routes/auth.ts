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

export const authRoutes = new Hono();

const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1),
});

authRoutes.post("/login", async (c) => {
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

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const token = await createSession({ userId: user.id, role: user.role });
  setSessionCookie(c, token);

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return c.json({ error: "Email already registered" }, 409);

  let referrerId: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (referrer && !referrer.frozen) referrerId = referrer.id;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let code = generateReferralCode();
  while (await prisma.user.findUnique({ where: { referralCode: code } })) {
    code = generateReferralCode();
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash, referralCode: code, referredBy: referrerId },
  });

  if (referrerId) {
    await prisma.referral.create({ data: { referrerId, referralId: user.id } });
  }

  const token = await createSession({ userId: user.id, role: user.role });
  setSessionCookie(c, token);

  return c.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

authRoutes.post("/logout", async (c) => {
  clearSessionCookie(c);
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
