import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";

export const earningsRoutes = new Hono();

earningsRoutes.get("/", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = 20;

  const [earnings, total] = await prisma.$transaction([
    prisma.earning.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.earning.count({ where: { userId: session.userId } }),
  ]);

  return c.json({ earnings, total, page, pages: Math.ceil(total / limit) });
});
