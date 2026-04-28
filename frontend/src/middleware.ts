import { NextResponse, type NextRequest } from "next/server";

/**
 * Auto-refresh the user's access token (`session` cookie) when it has
 * expired but the long-lived refresh token (`refresh_token` cookie) is
 * still present. Without this, the user is silently logged out the first
 * time they hit a protected page after the JWT TTL elapses.
 *
 * The refresh token is a random hex string stored in the backend DB —
 * not a JWT — so it survives JWT_SECRET rotation across deploys. That
 * means a redeploy that invalidates every access token doesn't kick
 * users out: the next request triggers a transparent refresh.
 *
 * Skipped on auth pages and static assets where there's nothing to
 * protect or where running the network call would slow first paint.
 */

const SKIP_PREFIXES = [
  "/_next",
  "/login",
  "/register",
  "/forgot-password",
  "/contact",
  "/disclaimer",
  "/privacy",
  "/terms",
  "/maintenance",
  "/activate",
  "/api",
  "/favicon",
  "/robots",
  "/sitemap",
  "/manifest",
  "/opengraph-image",
];

// Short-lived breadcrumb cookie set after a refresh attempt. If the
// rotated session cookie didn't take (cross-origin cookies blocked,
// third-party-cookie browser settings), this prevents an infinite
// redirect loop. Cleared by the browser within a minute regardless.
const ATTEMPT_COOKIE = "session_refresh_attempt";
const ATTEMPT_TTL_S = 60;

function shouldSkip(pathname: string): boolean {
  if (pathname === "/") return true;
  return SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function backendUrl(): string {
  return (
    process.env.API_URL_INTERNAL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000"
  );
}

export async function middleware(req: NextRequest) {
  if (shouldSkip(req.nextUrl.pathname)) return NextResponse.next();

  const session = req.cookies.get("session")?.value;
  const refresh = req.cookies.get("refresh_token")?.value;
  const alreadyTried = req.cookies.get(ATTEMPT_COOKIE)?.value;

  // Either we still have a (cookie-resident) access token, or we have no
  // refresh token to spend — let the request through. If the token is
  // expired but the cookie is still there, the backend will return 401
  // and the user's layout will redirect to /login.
  if (session || !refresh) {
    // Clean up the breadcrumb on the next normal request.
    if (alreadyTried && session) {
      const res = NextResponse.next();
      res.cookies.delete(ATTEMPT_COOKIE);
      return res;
    }
    return NextResponse.next();
  }

  // We just tried to refresh on the previous request and the rotated
  // cookie didn't survive. Don't loop — let the layout handle the bounce.
  if (alreadyTried) return NextResponse.next();

  try {
    const upstream = await fetch(`${backendUrl()}/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: `refresh_token=${refresh}`,
        "content-type": "application/json",
      },
      cache: "no-store",
    });

    if (!upstream.ok) return NextResponse.next();

    const setCookies = upstream.headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) return NextResponse.next();

    // Forward the rotated session + refresh cookies, drop a one-minute
    // breadcrumb so we don't loop if the cookies fail to persist, then
    // redirect to the same URL. The browser re-requests with the fresh
    // session cookie so the page's server components see new auth state.
    const res = NextResponse.redirect(req.nextUrl);
    for (const c of setCookies) {
      res.headers.append("set-cookie", c);
    }
    res.cookies.set({
      name: ATTEMPT_COOKIE,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ATTEMPT_TTL_S,
    });
    return res;
  } catch {
    // Network glitch — let the request through. Worst case, the user
    // sees one 401 and gets bounced to /login on the next navigation.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Skip Next internals and static files; everything else runs through
    // the middleware where shouldSkip() decides per-pathname.
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
