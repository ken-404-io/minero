import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/session.js";
import { getPlanConfig, isActivated } from "../lib/config.js";
import { paymentProvider } from "../lib/payments.js";

export const plansRoutes = new Hono();

/**
 * Start the one-time ₱49 activation payment. Creates a PENDING PlanLog row —
 * the user's plan is NOT changed until the PayMongo webhook confirms
 * `checkout_session.payment.paid` (or an admin manually approves).
 */
plansRoutes.post("/pay-signup", async (c) => {
  const session = requireAuth(c);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (user.frozen) return c.json({ error: "Account suspended" }, 403);

  if (isActivated(user.plan)) {
    return c.json({ error: "already_activated" }, 400);
  }

  const planConfig = await getPlanConfig("paid");

  // Reuse an existing pending row if one already exists so refreshing the
  // activate page doesn't create a backlog of orphan PlanLog rows.
  const existingPending = await prisma.planLog.findFirst({
    where: { userId: user.id, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const checkout = await paymentProvider.createCheckout({
    userId: user.id,
    plan: "paid",
    amountPhp: planConfig.price,
  });

  if (existingPending) {
    await prisma.planLog.update({
      where: { id: existingPending.id },
      data: {
        paymentRef: checkout.reference,
        paymentProvider: checkout.provider,
        amountPaid: planConfig.price,
        plan: "paid",
      },
    });
  } else {
    await prisma.planLog.create({
      data: {
        userId: user.id,
        plan: "paid",
        amountPaid: planConfig.price,
        paymentRef: checkout.reference,
        paymentProvider: checkout.provider,
        status: "pending",
      },
    });
  }

  return c.json({
    ok: true,
    redirectUrl: checkout.redirectUrl,
    reference: checkout.reference,
  });
});

/**
 * User's own payment history. Lets the frontend show "pending" and
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
