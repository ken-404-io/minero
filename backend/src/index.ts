import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware } from "./lib/session.js";
import { authRoutes } from "./routes/auth.js";
import { claimRoutes } from "./routes/claim.js";
import { earningsRoutes } from "./routes/earnings.js";
import { plansRoutes } from "./routes/plans.js";
import { referralsRoutes } from "./routes/referrals.js";
import { withdrawRoutes } from "./routes/withdraw.js";
import { redeemRoutes } from "./routes/redeem.js";
import { adminRoutes } from "./routes/admin.js";
import { otpRoutes } from "./routes/otp.js";
import { paymentRoutes } from "./routes/payments.js";
import { oauthRoutes } from "./routes/oauth.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { achievementRoutes } from "./routes/achievements.js";
import { gameRoutes } from "./routes/game.js";
import { startQueue, stopQueue } from "./lib/queue.js";
import { prisma } from "./lib/db.js";
import { DEFAULT_PLANS, getConfig, invalidateConfigCache } from "./lib/config.js";

/**
 * One-time backfill: when gameCoinsBalance was added via prisma db push, existing
 * GameSession rows already had coinsEarned > 0 but User.gameCoinsBalance stayed 0.
 * For every user whose balance is still 0 but has finished sessions with coins,
 * set their balance to the historical sum so the Game Hub KPI shows the correct value.
 */
async function backfillGameCoinsBalance() {
  try {
    const usersWithSessions = await prisma.gameSession.groupBy({
      by: ["userId"],
      where: { finishedAt: { not: null }, coinsEarned: { gt: 0 } },
      _sum: { coinsEarned: true },
    });

    let backfilled = 0;
    for (const row of usersWithSessions) {
      const total = row._sum.coinsEarned ?? 0;
      if (total <= 0) continue;
      const updated = await prisma.user.updateMany({
        where: { id: row.userId, gameCoinsBalance: 0 },
        data: { gameCoinsBalance: total },
      });
      if (updated.count > 0) backfilled++;
    }

    if (backfilled > 0) {
      console.log(`[startup] Backfilled gameCoinsBalance for ${backfilled} user(s)`);
    }
  } catch (err) {
    console.warn("[startup] Could not backfill gameCoinsBalance:", err);
  }
}

async function migratePlanConfig() {
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: "plans" } });
    if (!row) return;
    const stored = JSON.parse(row.value) as Record<string, { ratePerClaim?: number; dailyCap?: number }>;
    if ((stored.free?.ratePerClaim ?? 0) === 0 || (stored.free?.dailyCap ?? 0) === 0) {
      await prisma.platformConfig.update({
        where: { key: "plans" },
        data: { value: JSON.stringify(DEFAULT_PLANS), updatedBy: "auto-migrate" },
      });
      invalidateConfigCache();
      console.log("[startup] Migrated free plan config to ad-supported model (ratePerClaim=0.02, dailyCap=5)");
    }
  } catch (err) {
    console.warn("[startup] Could not migrate plan config:", err);
  }
}

const app = new Hono();

const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => (frontendOrigins.includes(origin) ? origin : null),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Device-Hash"],
  })
);

// Security response headers for all API responses.
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
});

app.use("*", sessionMiddleware);

app.get("/", (c) => c.json({ service: "minero-backend", status: "ok" }));
app.get("/health", (c) => c.json({ ok: true }));
app.get("/config", async (c) => {
  const cfg = await getConfig();
  return c.json({
    plans: cfg.plans,
    claimIntervalMs: cfg.claimIntervalMs,
    withdrawalMinimum: cfg.withdrawalMinimum,
  });
});

// Always-accessible routes (auth, OTP, activation payment, webhook).
app.route("/auth", authRoutes);
app.route("/auth/oauth", oauthRoutes);
app.route("/otp", otpRoutes);
app.route("/plans", plansRoutes);
app.route("/payments", paymentRoutes);
app.route("/admin", adminRoutes);

// App features require authentication only — all signed-in users have full access.
// Ads are shown to free-plan users; paying ₱49 removes ads (plan: "paid").

app.route("/claim", claimRoutes);
app.route("/earnings", earningsRoutes);
app.route("/redeem", redeemRoutes);
app.route("/referrals", referralsRoutes);
app.route("/withdraw", withdrawRoutes);
app.route("/leaderboard", leaderboardRoutes);
app.route("/achievements", achievementRoutes);
app.route("/game", gameRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

function warnMisconfigs() {
  if (process.env.NODE_ENV !== "production") return;

  const warn = (msg: string) => console.warn(`\x1b[33m[config-warning]\x1b[0m ${msg}`);

  const smsProvider = (process.env.SMS_PROVIDER ?? "").toLowerCase();
  const hasSmsCreds =
    (smsProvider === "semaphore" && process.env.SEMAPHORE_API_KEY) ||
    (smsProvider === "twilio" &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM) ||
    (!smsProvider && process.env.SEMAPHORE_API_KEY);

  if (!hasSmsCreds) {
    warn("SMS_PROVIDER is not configured. OTP codes will only be logged to the console.");
    warn("Withdrawals require a working OTP — users will be unable to cash out.");
    warn("Set SMS_PROVIDER=semaphore and SEMAPHORE_API_KEY, or SMS_PROVIDER=twilio.");
  }

  const paymongoKey = process.env.PAYMONGO_SECRET_KEY ?? "";
  if (!paymongoKey || paymongoKey.startsWith("sk_test_")) {
    warn("PAYMONGO_SECRET_KEY is a test key or missing. Payments will not be charged.");
    warn("Replace with a live key from https://dashboard.paymongo.com/developers");
  }

  if (!process.env.RESEND_API_KEY) {
    warn("RESEND_API_KEY is not set. Transactional emails will only be logged to the console.");
    warn("Users will not receive welcome emails, withdrawal confirmations, or password reset codes.");
  }
}

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`minero-backend listening on http://localhost:${info.port}`);
  warnMisconfigs();
  migratePlanConfig();
  backfillGameCoinsBalance();
  // Fire-and-forget; enqueue() lazy-starts on first use if this hasn't
  // finished yet, and falls back to sync if it never does.
  startQueue().catch((err) => console.warn("[queue] initial start failed:", err));
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await stopQueue();
    process.exit(0);
  });
}
