import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { rateLimit } from "../lib/rateLimit.js";

export const reportRoutes = new Hono();

reportRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  // Basic burst guard — not the once-per-day limit (that's enforced via DB below).
  const rl = rateLimit(`report:${session.userId}`, 5, 60_000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests. Try again shortly." }, 429);
  }

  const body = (await c.req.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (message.length < 10) {
    return c.json({ error: "Please describe the problem (at least 10 characters)." }, 400);
  }
  if (message.length > 1_000) {
    return c.json({ error: "Message too long (max 1,000 characters)." }, 400);
  }

  // Once per UTC day
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.problemReport.findFirst({
    where: { userId: session.userId, createdAt: { gte: startOfDay } },
    select: { id: true },
  });
  if (existing) {
    return c.json(
      { error: "You have already submitted a report today. Try again tomorrow." },
      429,
    );
  }

  await prisma.problemReport.create({
    data: { userId: session.userId, message },
  });

  return c.json({ ok: true });
});
