import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { canUpgradeTo, getPlanConfig } from "../lib/config.js";
import { paymentProvider } from "../lib/payments.js";

export const plansRoutes = new Hono();

const upgradeSchema = z.object({
  plan: z.enum(["plan499", "plan699", "plan799"]),
  paymentRef: z.string().min(5).max(100),
});

/**
 * Start a plan upgrade. Creates a PENDING PlanLog row — the user's plan
 * is NOT changed until an admin approves (or a payment webhook fires).
 */
plansRoutes.post("/upgrade", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }

  const parsed = upgradeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { plan, paymentRef } = parsed.data;
  if (!canUpgradeTo(user.plan, plan)) {
    return c.json({ error: "Cannot downgrade or re-purchase current plan" }, 400);
  }

  const planConfig = await getPlanConfig(plan);

  // Reject if another pending upgrade is already in the queue
  const pending = await prisma.planLog.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (pending) {
    return c.json({ error: "You already have a pending plan upgrade request." }, 409);
  }

  const checkout = await paymentProvider.createCheckout({
    userId: user.id,
    plan,
    amountPhp: planConfig.price,
    paymentRef,
  });

  const log = await prisma.planLog.create({
    data: {
      userId: user.id,
      plan,
      amountPaid: planConfig.price,
      paymentRef: checkout.reference,
      paymentProvider: checkout.provider,
      status: "pending",
    },
  });

  return c.json({
    ok: true,
    status: "pending",
    plan,
    label: planConfig.label,
    reference: checkout.reference,
    redirectUrl: checkout.redirectUrl,
    planLogId: log.id,
  });
});

/**
 * User's own upgrade history. Lets the frontend show "pending" and
 * prevents double-submits.
 */
plansRoutes.get("/my-upgrades", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const logs = await prisma.planLog.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return c.json({ upgrades: logs });
});
