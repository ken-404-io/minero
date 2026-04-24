import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { issueOtp } from "../lib/otp.js";
import { rateLimit } from "../lib/rateLimit.js";

export const otpRoutes = new Hono();

const sendSchema = z.object({
  purpose: z.enum(["withdraw", "change_password"]),
  destination: z
    .string()
    .regex(/^09\d{9}$/, "Must be a valid PH mobile number")
    .optional(),
});

otpRoutes.post("/send", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  // 5 OTP sends per user per hour — SMS costs real money.
  const rl = rateLimit(`otp:${session.userId}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    c.header("Retry-After", String(Math.ceil(rl.retryAfterMs / 1000)));
    return c.json({ error: "Too many verification codes sent. Try again later." }, 429);
  }

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  // Fallback: use email as destination when no phone is on file.
  const destination = parsed.data.destination ?? user.email;

  const issued = await issueOtp({
    userId: user.id,
    purpose: parsed.data.purpose,
    destination,
  });

  return c.json({
    ok: true,
    expiresAt: issued.expiresAt,
    destinationMasked: maskDestination(destination),
  });
});

function maskDestination(d: string): string {
  if (d.includes("@")) {
    const [local, domain] = d.split("@");
    if (!local || !domain) return d;
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (d.length < 4) return "****";
  return `${d.slice(0, 2)}****${d.slice(-2)}`;
}
