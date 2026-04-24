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
import { prisma } from "./lib/db.js";
import { DEFAULT_PLANS, invalidateConfigCache } from "./lib/config.js";

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
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`minero-backend listening on http://localhost:${info.port}`);
  migratePlanConfig();
});
