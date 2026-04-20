import crypto from "node:crypto";

// OAuth 2.0 / OpenID Connect provider interface.
//
// To enable a provider, set its env vars in backend/.env:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
//   OAUTH_REDIRECT_BASE (e.g. "http://localhost:4000" in dev)
//
// Providers that aren't configured are simply not exposed — the frontend
// can still render the button but clicking it returns a 501.

export type OAuthUser = {
  provider: "google" | "facebook";
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
};

export interface OAuthProvider {
  readonly name: "google" | "facebook";
  readonly available: boolean;
  /** Build the authorize URL the user is redirected to. */
  authorizeUrl(state: string): string;
  /** Exchange the code for a user profile. Throws on failure. */
  exchange(params: { code: string }): Promise<OAuthUser>;
}

function base() {
  return process.env.OAUTH_REDIRECT_BASE ?? `http://localhost:${process.env.PORT ?? 4000}`;
}

function redirectUriFor(name: "google" | "facebook"): string {
  return `${base()}/auth/oauth/${name}/callback`;
}

class GoogleProvider implements OAuthProvider {
  readonly name = "google" as const;

  get available() {
    return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  }

  authorizeUrl(state: string): string {
    const p = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUriFor("google"),
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      include_granted_scopes: "true",
      state,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
  }

  async exchange({ code }: { code: string }): Promise<OAuthUser> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUriFor("google"),
        grant_type: "authorization_code",
        code,
      }).toString(),
    });
    if (!tokenRes.ok) {
      throw new Error(`google_token_exchange_failed:${tokenRes.status}`);
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("google_no_access_token");

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`google_userinfo_failed:${profileRes.status}`);
    const p = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };
    if (!p.sub || !p.email) throw new Error("google_missing_profile_fields");

    return {
      provider: "google",
      providerId: p.sub,
      email: p.email.toLowerCase(),
      name: p.name ?? p.email.split("@")[0],
      avatarUrl: p.picture ?? null,
      emailVerified: p.email_verified ?? false,
    };
  }
}

class FacebookProvider implements OAuthProvider {
  readonly name = "facebook" as const;

  get available() {
    return !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET;
  }

  authorizeUrl(state: string): string {
    const p = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      redirect_uri: redirectUriFor("facebook"),
      state,
      scope: "email,public_profile",
      response_type: "code",
    });
    return `https://www.facebook.com/v18.0/dialog/oauth?${p.toString()}`;
  }

  async exchange({ code }: { code: string }): Promise<OAuthUser> {
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: redirectUriFor("facebook"),
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`,
    );
    if (!tokenRes.ok) {
      throw new Error(`facebook_token_exchange_failed:${tokenRes.status}`);
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("facebook_no_access_token");

    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${encodeURIComponent(
        tokens.access_token,
      )}`,
    );
    if (!profileRes.ok) throw new Error(`facebook_userinfo_failed:${profileRes.status}`);
    const p = (await profileRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
      picture?: { data?: { url?: string } };
    };
    if (!p.id) throw new Error("facebook_missing_profile_fields");
    if (!p.email) {
      throw new Error("facebook_missing_email"); // user denied email permission
    }

    return {
      provider: "facebook",
      providerId: p.id,
      email: p.email.toLowerCase(),
      name: p.name ?? p.email.split("@")[0],
      avatarUrl: p.picture?.data?.url ?? null,
      emailVerified: true, // FB never returns an unverified email
    };
  }
}

const providers: Record<"google" | "facebook", OAuthProvider> = {
  google: new GoogleProvider(),
  facebook: new FacebookProvider(),
};

export function getOAuthProvider(name: string): OAuthProvider | null {
  if (name !== "google" && name !== "facebook") return null;
  return providers[name];
}

/** Available providers, used by the frontend to show/hide buttons. */
export function listAvailableOAuthProviders(): string[] {
  return Object.values(providers)
    .filter((p) => p.available)
    .map((p) => p.name);
}

export function generateState(): string {
  return crypto.randomBytes(24).toString("hex");
}
