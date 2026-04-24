import { Hono } from "hono";
import { prisma } from "../lib/db.js";
import { paymentProvider } from "../lib/payments.js";
import { emailProvider, planUpgradedHtml } from "../lib/email.js";

export const paymentRoutes = new Hono();

/**
 * PayMongo webhook — authenticates the async callback via HMAC-SHA256 and
 * transitions the PlanLog from pending to approved (activating the user's
 * account) or rejected.
 *
 * Signature verification lives in paymentProvider.verifyWebhook().
 */
paymentRoutes.post("/webhook", async (c) => {
  const rawBody = await c.req.text();
  const signature =
    c.req.header("paymongo-signature") ??
    c.req.header("Paymongo-Signature") ??
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
    if (user.plan === "paid") {
      await prisma.planLog.update({
        where: { id: log.id },
        data: { status: "approved", reviewedAt: new Date(), reviewedBy: "webhook", adminNote: "already_activated" },
      });
      return c.json({ ok: true, applied: false, note: "already_activated" });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { plan: "paid" } }),
      prisma.planLog.update({
        where: { id: log.id },
        data: { status: "approved", reviewedAt: new Date(), reviewedBy: "webhook" },
      }),
    ]);

    emailProvider
      .send({
        to: user.email,
        subject: "Upgrade confirmed — ad-free activated",
        html: planUpgradedHtml({ name: user.name, amountPaid: log.amountPaid }),
      })
      .catch((err) => console.warn("[email] upgrade send failed:", err));

    return c.json({ ok: true, applied: true });
  }

  await prisma.planLog.update({
    where: { id: log.id },
    data: { status: "rejected", reviewedAt: new Date(), reviewedBy: "webhook", adminNote: verdict.status },
  });
  return c.json({ ok: true, applied: false });
});
