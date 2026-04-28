import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { prisma } from "../lib/db.js";
import { createSession, generateReferralCode } from "../lib/auth.js";
import { setSessionCookie } from "../lib/session.js";
import {
  issueRefreshToken,
  setRefreshCookie,
} from "../lib/refresh.js";
import {
  getOAuthProvider,
  generateState,
  listOAuthProviders,
} from "../lib/oauth.js";
import { getClientIp, getDeviceHash } from "../lib/request.js";
import {
  checkDeviceAvailableForSignup,
  raiseDeviceFraudAlert,
} from "../lib/deviceFraud.js";

export const oauthRoutes = new Hono();

const DEVICE_HASH_RE = /^[a-f0-9]{16,128}$/i;

const STATE_COOKIE = "oauth_state";

function stateCookieOpts(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax", // OAuth redirects are top-level navigations
    path: "/",
    maxAge: 600, // 10 minutes
  };
}

function frontendOrigin(): string {
  return (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000").split(",")[0].trim();
}

// List every supported provider with its configuration state. The frontend
// renders all of them, disabling the ones that aren't configured.
oauthRoutes.get("/providers", (c) => {
  return c.json({ providers: listOAuthProviders() });
});

// Kick off the OAuth flow — redirects to the provider.
oauthRoutes.get("/:provider", (c) => {
  const name = c.req.param("provider");
  const provider = getOAuthProvider(name);
  if (!provider) return c.json({ error: "Unknown provider" }, 404);
  if (!provider.available) {
    return c.json(
      { error: `${name} is not configured on this server` },
      501,
    );
  }

  const state = generateState();
  // Optional ?ref=CODE for invite tracking; carried through state cookie.
  const ref = c.req.query("ref") ?? "";
  // Optional ?dh=<hex> — client-computed device fingerprint. Stored in the
  // state cookie so the callback can enforce one-account-per-device parity
  // with the email/password register flow. Headers can't be set on a
  // top-level navigation, hence the query param.
  const dhRaw = c.req.query("dh") ?? "";
  const dh = DEVICE_HASH_RE.test(dhRaw) ? dhRaw.toLowerCase() : "";
  const payload = JSON.stringify({ state, ref, dh });
  setCookie(c, STATE_COOKIE, payload, stateCookieOpts());

  return c.redirect(provider.authorizeUrl(state));
});

// Callback from the provider — exchange code, upsert user, issue session.
oauthRoutes.get("/:provider/callback", async (c) => {
  const name = c.req.param("provider");
  const provider = getOAuthProvider(name);
  if (!provider) return c.redirect(`${frontendOrigin()}/login?error=unknown_provider`);

  const code = c.req.query("code");
  const state = c.req.query("state");
  const cookieRaw = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });

  if (!code || !state || !cookieRaw) {
    return c.redirect(`${frontendOrigin()}/login?error=bad_callback`);
  }
  let parsed: { state?: string; ref?: string; dh?: string };
  try {
    parsed = JSON.parse(cookieRaw) as typeof parsed;
  } catch {
    return c.redirect(`${frontendOrigin()}/login?error=bad_callback`);
  }
  if (parsed.state !== state) {
    return c.redirect(`${frontendOrigin()}/login?error=state_mismatch`);
  }

  // Prefer the fingerprint we captured on the start request (set in the
  // state cookie). Fall back to the header if the start request was a
  // direct API call. Either may be empty — registration enforces presence.
  const stateDh = parsed.dh && DEVICE_HASH_RE.test(parsed.dh) ? parsed.dh.toLowerCase() : null;
  const headerDh = getDeviceHash(c);
  const deviceHash = stateDh ?? headerDh;

  let profile;
  try {
    profile = await provider.exchange({ code });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "exchange_failed";
    return c.redirect(`${frontendOrigin()}/login?error=${encodeURIComponent(msg)}`);
  }

  // Upsert: match on (authProvider, authProviderId) first, then fall back
  // to email. If email exists but with a different provider, refuse.
  let user = await prisma.user.findFirst({
    where: { authProvider: profile.provider, authProviderId: profile.providerId },
  });

  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      if (byEmail.authProvider && byEmail.authProvider !== profile.provider) {
        return c.redirect(
          `${frontendOrigin()}/login?error=${encodeURIComponent(
            `email_uses_${byEmail.authProvider}`,
          )}`,
        );
      }
      if (!byEmail.authProvider) {
        // Email/password account — link this OAuth identity to it.
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            authProvider: profile.provider,
            authProviderId: profile.providerId,
            avatarUrl: profile.avatarUrl ?? byEmail.avatarUrl,
          },
        });
      } else {
        user = byEmail;
      }
    }
  }

  if (!user) {
    // Brand new account. Apply a referral code if we have one in the state cookie.
    let referrerId: string | undefined;
    if (parsed.ref) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: parsed.ref },
        select: { id: true, frozen: true },
      });
      if (referrer && !referrer.frozen) referrerId = referrer.id;
    }

    const ip = getClientIp(c);

    // One-account-per-device enforcement, parity with /auth/register.
    // No fingerprint = no signup (the user might be using a privacy
    // browser; we'd rather fail closed than let abuse through).
    if (!deviceHash) {
      return c.redirect(`${frontendOrigin()}/login?error=device_required`);
    }

    const deviceCheck = await checkDeviceAvailableForSignup(deviceHash);
    if (!deviceCheck.ok) {
      await raiseDeviceFraudAlert({
        attemptedEmail: profile.email,
        existingUserId: deviceCheck.existingUserId,
        ip,
        deviceHash,
        via: "oauth",
      });
      return c.redirect(`${frontendOrigin()}/login?error=device_in_use`);
    }

    let code = generateReferralCode();
    while (await prisma.user.findUnique({ where: { referralCode: code } })) {
      code = generateReferralCode();
    }

    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        referralCode: code,
        referredBy: referrerId ?? null,
        authProvider: profile.provider,
        authProviderId: profile.providerId,
        avatarUrl: profile.avatarUrl ?? null,
        signupIp: ip === "unknown" ? null : ip,
        signupDevice: deviceHash,
        lastDeviceHash: deviceHash,
      },
    });
    if (referrerId) {
      await prisma.referral.create({
        data: { referrerId, referralId: user.id },
      });
    }
  } else if (deviceHash && user.role !== "admin") {
    // Existing account logging in via OAuth. Update lastDeviceHash and
    // raise a fraud alert if this device is already bound to another
    // non-frozen account.
    const otherAccount = await prisma.user.findFirst({
      where: {
        frozen: false,
        id: { not: user.id },
        OR: [{ signupDevice: deviceHash }, { lastDeviceHash: deviceHash }],
      },
      select: { id: true },
    });
    if (otherAccount) {
      await raiseDeviceFraudAlert({
        attemptedEmail: profile.email,
        attemptedUserId: user.id,
        existingUserId: otherAccount.id,
        ip: getClientIp(c),
        deviceHash,
        via: "login",
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { lastDeviceHash: deviceHash },
    });
  }

  if (user.frozen) {
    return c.redirect(`${frontendOrigin()}/login?error=account_suspended`);
  }

  // Issue session + refresh token
  const token = await createSession({ userId: user.id, role: user.role });
  setSessionCookie(c, token);
  const refresh = await issueRefreshToken({
    userId: user.id,
    ip: getClientIp(c),
    userAgent: c.req.header("user-agent") ?? null,
  });
  setRefreshCookie(c, refresh.token);

  const target = user.role === "admin" ? "/admin" : "/dashboard";
  return c.redirect(`${frontendOrigin()}${target}`);
});
