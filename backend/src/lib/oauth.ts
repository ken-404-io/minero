import crypto from "node:crypto";

// OAuth 2.0 / OpenID Connect provider interface.
//
// To enable a provider, set its env vars in backend/.env:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//   FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
//   OAUTH_REDIRECT_BASE (e.g. "http://localhost:4000" in dev)
//
// Providers that aren't configured are still listed by /providers but
// marked unavailable — the frontend renders them as disabled buttons.

export type OAuthProviderName = "google" | "facebook" | "github";

export type OAuthUser = {
  provider: OAuthProviderName;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
};

export interface OAuthProvider {
  readonly name: OAuthProviderName;
  readonly available: boolean;
  /** Build the authorize URL the user is redirected to. */
  authorizeUrl(state: string): string;
  /** Exchange the code for a user profile. Throws on failure. */
  exchange(params: { code: string }): Promise<OAuthUser>;
}

function base() {
  return process.env.OAUTH_REDIRECT_BASE ?? `http://localhost:${process.env.PORT ?? 4000}`;
}

function redirectUriFor(name: OAuthProviderName): string {
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

class GitHubProvider implements OAuthProvider {
  readonly name = "github" as const;

  get available() {
    return !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  }

  authorizeUrl(state: string): string {
    const p = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUriFor("github"),
      scope: "read:user user:email",
      state,
      allow_signup: "true",
    });
    return `https://github.com/login/oauth/authorize?${p.toString()}`;
  }

  async exchange({ code }: { code: string }): Promise<OAuthUser> {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: redirectUriFor("github"),
        code,
      }),
    });
    if (!tokenRes.ok) throw new Error(`github_token_exchange_failed:${tokenRes.status}`);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("github_no_access_token");

    const auth = `Bearer ${tokens.access_token}`;
    const headers = {
      Authorization: auth,
      Accept: "application/vnd.github+json",
      "User-Agent": "minero-app",
    };

    const profileRes = await fetch("https://api.github.com/user", { headers });
    if (!profileRes.ok) throw new Error(`github_userinfo_failed:${profileRes.status}`);
    const p = (await profileRes.json()) as {
      id?: number;
      login?: string;
      name?: string | null;
      email?: string | null;
      avatar_url?: string;
    };
    if (typeof p.id !== "number") throw new Error("github_missing_profile_fields");

    let email = p.email ?? null;
    let emailVerified = !!email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primary = emails.find((e) => e.primary && e.verified)
          ?? emails.find((e) => e.verified)
          ?? emails[0];
        if (primary) {
          email = primary.email;
          emailVerified = primary.verified;
        }
      }
    }
    if (!email) throw new Error("github_missing_email");

    return {
      provider: "github",
      providerId: String(p.id),
      email: email.toLowerCase(),
      name: p.name?.trim() || p.login || email.split("@")[0],
      avatarUrl: p.avatar_url ?? null,
      emailVerified,
    };
  }
}

const providers: Record<OAuthProviderName, OAuthProvider> = {
  google: new GoogleProvider(),
  facebook: new FacebookProvider(),
  github: new GitHubProvider(),
};

export function getOAuthProvider(name: string): OAuthProvider | null {
  if (name !== "google" && name !== "facebook" && name !== "github") return null;
  return providers[name];
}

/** All supported providers with their availability, used by the frontend
 *  to render buttons (disabled when unconfigured). */
export function listOAuthProviders(): Array<{ name: string; available: boolean }> {
  return Object.values(providers).map((p) => ({ name: p.name, available: p.available }));
}

export function generateState(): string {
  return crypto.randomBytes(24).toString("hex");
}
