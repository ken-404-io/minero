import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware, requireActivated } from "./lib/session.js";
import { authRoutes } from "./routes/auth.js";
import { claimRoutes } from "./routes/claim.js";
import { earningsRoutes } from "./routes/earnings.js";
import { plansRoutes } from "./routes/plans.js";
import { referralsRoutes } from "./routes/referrals.js";
import { withdrawRoutes } from "./routes/withdraw.js";
import { adminRoutes } from "./routes/admin.js";
import { otpRoutes } from "./routes/otp.js";
import { paymentRoutes } from "./routes/payments.js";
import { oauthRoutes } from "./routes/oauth.js";

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

// App features gated behind the ₱49 activation paywall.
app.use("/claim/*", requireActivated);
app.use("/earnings/*", requireActivated);
app.use("/referrals/*", requireActivated);
app.use("/withdraw/*", requireActivated);

app.route("/claim", claimRoutes);
app.route("/earnings", earningsRoutes);
app.route("/referrals", referralsRoutes);
app.route("/withdraw", withdrawRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`minero-backend listening on http://localhost:${info.port}`);
});
