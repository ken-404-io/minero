import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { PLANS, canUpgradeTo } from "../lib/mining.js";

export const plansRoutes = new Hono();

const upgradeSchema = z.object({
  plan: z.enum(["plan499", "plan699", "plan799"]),
  paymentRef: z.string().min(5).max(100),
});

plansRoutes.post("/upgrade", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = upgradeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { plan, paymentRef } = parsed.data;
  if (!canUpgradeTo(user.plan, plan)) {
    return c.json({ error: "Cannot downgrade or re-purchase current plan" }, 400);
  }

  const planConfig = PLANS[plan];

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { plan } }),
    prisma.planLog.create({
      data: { userId: user.id, plan, amountPaid: planConfig.price, paymentRef },
    }),
  ]);

  return c.json({ ok: true, plan, label: planConfig.label });
});
