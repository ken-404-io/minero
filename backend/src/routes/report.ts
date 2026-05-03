import { Hono } from "hono";
import { createHash } from "crypto";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { rateLimit } from "../lib/rateLimit.js";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME ?? "";
const API_KEY    = process.env.CLOUDINARY_API_KEY ?? "";
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? "";
const FOLDER     = "reports";

export const reportRoutes = new Hono();

// ============================================================
//  GET /report/upload-signature
//  Returns a short-lived signed upload token so the client can
//  upload directly to Cloudinary without exposing the API secret.
// ============================================================

reportRoutes.get("/upload-signature", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  if (!API_SECRET) {
    return c.json({ error: "Media upload not configured" }, 503);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signature: SHA1(sorted_params + api_secret) — NOT HMAC
  const toSign = `folder=${FOLDER}&timestamp=${timestamp}${API_SECRET}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  return c.json({ signature, timestamp, apiKey: API_KEY, cloudName: CLOUD_NAME, folder: FOLDER });
});

// ============================================================
//  POST /report
// ============================================================

reportRoutes.post("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  // Basic burst guard — not the once-per-day limit (that's enforced via DB below).
  const rl = rateLimit(`report:${session.userId}`, 5, 60_000);
  if (!rl.ok) {
    return c.json({ error: "Too many requests. Try again shortly." }, 429);
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    message?: unknown;
    mediaUrl?: unknown;
  };
  const message  = typeof body.message  === "string" ? body.message.trim()  : "";
  const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : undefined;

  if (message.length < 10) {
    return c.json({ error: "Please describe the problem (at least 10 characters)." }, 400);
  }
  if (message.length > 1_000) {
    return c.json({ error: "Message too long (max 1,000 characters)." }, 400);
  }

  // Validate mediaUrl is a Cloudinary URL if provided.
  if (mediaUrl && !mediaUrl.startsWith(`https://res.cloudinary.com/${CLOUD_NAME}/`)) {
    return c.json({ error: "Invalid media URL." }, 400);
  }

  // Admins can submit multiple reports per day (useful for testing / filing issues).
  const isAdmin = session.role === "admin";

  if (!isAdmin) {
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
  }

  await prisma.problemReport.create({
    data: { userId: session.userId, message, mediaUrl: mediaUrl ?? null },
  });

  return c.json({ ok: true });
});
