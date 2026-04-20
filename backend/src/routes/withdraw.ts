import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { getConfig } from "../lib/config.js";
import { verifyOtp } from "../lib/otp.js";

export const withdrawRoutes = new Hono();

const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["gcash", "maya"]),
  accountNumber: z.string().min(10).max(20).regex(/^\d+$/),
  otp: z.string().regex(/^\d{4,8}$/, "Enter the verification code"),
});

withdrawRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

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
  const cfg = await getConfig();
  if (amount < cfg.withdrawalMinimum) {
    return c.json({ error: `Minimum withdrawal is ₱${cfg.withdrawalMinimum}` }, 400);
  }
  if (user.balance < amount) return c.json({ error: "Insufficient balance" }, 400);

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

  return c.json({ ok: true });
});

withdrawRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.userId },
    orderBy: { requestedAt: "desc" },
  });
  return c.json({ withdrawals });
});
