import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { ensureMiningReadyNotification } from "../lib/notifications.js";

export const notificationRoutes = new Hono();

/** Paginated notifications for the signed-in user, newest first.
 *  Also returns the unread count so the UI can update its badge in one round-trip. */
notificationRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? "20")));

  await ensureMiningReadyNotification(session.userId);

  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where: { userId: session.userId } }),
    prisma.notification.count({
      where: { userId: session.userId, readAt: null },
    }),
  ]);

  return c.json({
    notifications,
    total,
    unread,
    page,
    pages: Math.ceil(total / limit),
  });
});

/** Lightweight unread-count endpoint for polling. */
notificationRoutes.get("/unread-count", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  await ensureMiningReadyNotification(session.userId);

  const unread = await prisma.notification.count({
    where: { userId: session.userId, readAt: null },
  });
  return c.json({ unread });
});

const markReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100).optional(),
  all: z.boolean().optional(),
});

/** Mark specific ids read, or all unread read with `{ all: true }`. */
notificationRoutes.post("/read", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = markReadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { ids, all } = parsed.data;
  const now = new Date();

  if (all) {
    const result = await prisma.notification.updateMany({
      where: { userId: session.userId, readAt: null },
      data: { readAt: now },
    });
    return c.json({ updated: result.count });
  }

  if (!ids || ids.length === 0) {
    return c.json({ error: "ids or all required" }, 400);
  }

  const result = await prisma.notification.updateMany({
    where: { userId: session.userId, id: { in: ids }, readAt: null },
    data: { readAt: now },
  });
  return c.json({ updated: result.count });
});

/** Delete a single notification (only the owner can delete). */
notificationRoutes.delete("/:id", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const id = c.req.param("id");
  const result = await prisma.notification.deleteMany({
    where: { id, userId: session.userId },
  });
  if (result.count === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});
