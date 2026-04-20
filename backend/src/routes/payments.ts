import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { paymentProvider } from "../lib/payments.js";
import { canUpgradeTo } from "../lib/config.js";

export const paymentRoutes = new Hono();

/**
 * Payment provider webhook — authenticates an async callback from
 * PayMongo / Xendit / etc. and transitions the PlanLog from pending
 * to approved (applying the plan to the user) or rejected.
 *
 * Provider-specific signature verification lives in paymentProvider.verifyWebhook().
 */
paymentRoutes.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature =
    c.req.header("x-signature") ??
    c.req.header("paymongo-signature") ??
    c.req.header("x-xendit-signature") ??
    null;

  const verdict = await paymentProvider.verifyWebhook({ rawBody, signature });
  if (!verdict.ok) return c.json({ error: verdict.reason }, 400);

  const log = await prisma.planLog.findFirst({
    where: { paymentRef: verdict.reference, status: "pending" },
  });
  if (!log) return c.json({ ok: true, note: "no_matching_pending_log" });

  if (verdict.status === "paid") {
    const user = await prisma.user.findUnique({ where: { id: log.userId } });
    if (!user || user.frozen) {
      await prisma.planLog.update({
        where: { id: log.id },
        data: { status: "rejected", reviewedAt: new Date(), adminNote: "user_unavailable" },
      });
      return c.json({ ok: true, note: "user_unavailable" });
    }
    if (!canUpgradeTo(user.plan, log.plan)) {
      await prisma.planLog.update({
        where: { id: log.id },
        data: { status: "rejected", reviewedAt: new Date(), adminNote: "cannot_upgrade" },
      });
      return c.json({ ok: true, note: "cannot_upgrade" });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { plan: log.plan } }),
      prisma.planLog.update({
        where: { id: log.id },
        data: { status: "approved", reviewedAt: new Date(), reviewedBy: "webhook" },
      }),
    ]);
    return c.json({ ok: true, applied: true });
  }

  await prisma.planLog.update({
    where: { id: log.id },
    data: { status: "rejected", reviewedAt: new Date(), reviewedBy: "webhook", adminNote: verdict.status },
  });
  return c.json({ ok: true, applied: false });
});
