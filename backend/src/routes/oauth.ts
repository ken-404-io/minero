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
  listAvailableOAuthProviders,
} from "../lib/oauth.js";
import { getClientIp, getDeviceHash } from "../lib/request.js";

export const oauthRoutes = new Hono();

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

// Expose which providers are configured — frontend hides buttons for the rest.
oauthRoutes.get("/providers", (c) => {
  return c.json({ providers: listAvailableOAuthProviders() });
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
  const payload = JSON.stringify({ state, ref });
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
  let parsed: { state?: string; ref?: string };
  try {
    parsed = JSON.parse(cookieRaw) as typeof parsed;
  } catch {
    return c.redirect(`${frontendOrigin()}/login?error=bad_callback`);
  }
  if (parsed.state !== state) {
    return c.redirect(`${frontendOrigin()}/login?error=state_mismatch`);
  }

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

    let code = generateReferralCode();
    while (await prisma.user.findUnique({ where: { referralCode: code } })) {
      code = generateReferralCode();
    }

    const ip = getClientIp(c);
    const deviceHash = getDeviceHash(c);

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
