import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { getConfig } from "../lib/config.js";
import { verifyOtp } from "../lib/otp.js";
import { rateLimit } from "../lib/rateLimit.js";
import { withdrawalSubmittedHtml } from "../lib/email.js";
import { enqueue, QUEUE_EMAIL } from "../lib/queue.js";
import { createNotification } from "../lib/notifications.js";

export const withdrawRoutes = new Hono();

const REFERRAL_REQUIRED = 50;

// ============================================================
//  Withdraw gate — checks & lazily initialises the invite gate
// ============================================================

withdrawRoutes.get("/gate", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const cfg = await getConfig();
  let user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const balanceQualifies = user.balance >= cfg.withdrawalMinimum;

  // Lazily stamp the moment this user first reached the withdrawal minimum.
  // Once set it never resets — only referrals made after this point count.
  if (balanceQualifies && !user.withdrawGateUnlockedAt) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { withdrawGateUnlockedAt: new Date() },
    });
  }

  // Count referrals made after the gate was unlocked.
  const postUnlockReferrals = user.withdrawGateUnlockedAt
    ? await prisma.referral.count({
        where: {
          referrerId: user.id,
          createdAt: { gte: user.withdrawGateUnlockedAt },
        },
      })
    : 0;

  const gateComplete = postUnlockReferrals >= REFERRAL_REQUIRED;
  const canWithdraw = balanceQualifies && gateComplete;

  return c.json({
    balanceQualifies,
    gateUnlockedAt: user.withdrawGateUnlockedAt ?? null,
    referralsMade: postUnlockReferrals,
    referralsRequired: REFERRAL_REQUIRED,
    gateComplete,
    canWithdraw,
  });
});

// ============================================================
//  POST /withdraw
// ============================================================

const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["gcash", "maya"]),
  accountNumber: z.string().min(10).max(20).regex(/^\d+$/),
  otp: z.string().regex(/^\d{4,8}$/, "Enter the verification code"),
});

withdrawRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const cfg = await getConfig();
  if (!cfg.withdrawalsEnabled) {
    return c.json({ error: "Withdrawals are temporarily disabled. Please check back later." }, 503);
  }

  // 3 withdrawal requests per user per hour.
  const rl = rateLimit(`withdraw:${session.userId}`, 3, 60 * 60 * 1000);
  if (!rl.ok) {
    c.header("Retry-After", String(Math.ceil(rl.retryAfterMs / 1000)));
    return c.json({ error: "Too many withdrawal requests. Try again later." }, 429);
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { amount, method, accountNumber, otp } = parsed.data;
  if (amount < cfg.withdrawalMinimum) {
    return c.json({ error: `Minimum withdrawal is ₱${cfg.withdrawalMinimum}` }, 400);
  }
  if (user.balance < amount) return c.json({ error: "Insufficient balance" }, 400);

  // Enforce the invite gate server-side so it cannot be bypassed via the API.
  if (!user.withdrawGateUnlockedAt) {
    return c.json({ error: "Withdrawal gate not yet unlocked" }, 403);
  }
  const postUnlockReferrals = await prisma.referral.count({
    where: { referrerId: user.id, createdAt: { gte: user.withdrawGateUnlockedAt } },
  });
  if (postUnlockReferrals < REFERRAL_REQUIRED) {
    const remaining = REFERRAL_REQUIRED - postUnlockReferrals;
    return c.json({
      error: `Invite ${remaining} more ${remaining === 1 ? "person" : "people"} to unlock withdrawal`,
    }, 403);
  }

  const pending = await prisma.withdrawal.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (pending) return c.json({ error: "You already have a pending withdrawal" }, 409);

  // Verify OTP before debiting. One-time use — consumed on success.
  const otpResult = await verifyOtp({
    userId: user.id,
    purpose: "withdraw",
    code: otp,
  });
  if (!otpResult.ok) {
    return c.json({ error: `Verification code ${otpResult.reason}` }, 400);
  }

  await prisma.$transaction([
    prisma.withdrawal.create({
      data: { userId: user.id, amount, method, accountNumber },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { balance: { decrement: amount } },
    }),
  ]);

  await enqueue(QUEUE_EMAIL, {
    to: user.email,
    subject: "Withdrawal Request Received — Minero",
    html: withdrawalSubmittedHtml({ name: user.name, amount, method }),
  });

  await createNotification({
    userId: user.id,
    type: "withdrawal_submitted",
    title: "Withdrawal request received",
    body: `Your ₱${amount.toFixed(2)} withdrawal to ${method.toUpperCase()} is pending review.`,
    link: "/withdraw",
  });

  return c.json({ ok: true });
});

// ============================================================
//  GET /withdraw — history
// ============================================================

withdrawRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.userId },
    orderBy: { requestedAt: "desc" },
  });
  return c.json({ withdrawals });
});
