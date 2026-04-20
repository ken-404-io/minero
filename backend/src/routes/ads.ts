import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { issueAdToken, markAdViewed } from "../lib/ads.js";
import { getClientIp, getDeviceHash } from "../lib/request.js";

export const adRoutes = new Hono();

adRoutes.post("/view-start", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  const issued = await issueAdToken({
    userId: user.id,
    placement: "claim",
    ip: getClientIp(c),
    deviceHash: getDeviceHash(c),
  });

  return c.json({
    token: issued.token,
    expiresAt: issued.expiresAt,
    minViewDurationMs: issued.minViewDurationMs,
    provider: issued.provider,
  });
});

const completeSchema = z.object({
  token: z.string().min(16).max(128),
  elapsedMs: z.number().int().min(0).max(10 * 60 * 1000),
});

adRoutes.post("/view-complete", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten().fieldErrors }, 400);

  const result = await markAdViewed({
    userId: session.userId,
    token: parsed.data.token,
    elapsedMs: parsed.data.elapsedMs,
  });

  if (!result.ok) return c.json({ error: result.reason }, 400);
  return c.json({ ok: true, estimatedRevenue: result.estimatedRevenue });
});
