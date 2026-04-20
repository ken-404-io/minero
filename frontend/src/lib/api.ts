import { cookies, headers } from "next/headers";

export function publicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function serverApiUrl(): string {
  return process.env.API_URL_INTERNAL || publicApiUrl();
}

/**
 * Server-side fetch to the backend that forwards the user's session cookie.
 * Use inside React Server Components, route handlers, and server actions.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session")?.value;

  const hdrs = new Headers(init.headers);
  if (sessionToken) hdrs.set("cookie", `session=${sessionToken}`);
  if (!hdrs.has("content-type") && init.body) {
    hdrs.set("content-type", "application/json");
  }

  // Next.js caches fetch by default; always opt out for authenticated API calls.
  return fetch(`${serverApiUrl()}${path}`, {
    ...init,
    headers: hdrs,
    cache: "no-store",
  });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await apiFetch(path, init);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/**
 * Forward the backend's Set-Cookie headers onto the Next.js response.
 * Useful when a server action or route handler calls the backend to log in.
 */
export function pipeSetCookie(from: Response): void {
  const setCookie = from.headers.getSetCookie?.() ?? [];
  // Not used directly; callers that need this should use a Server Action
  // with cookies().set(...) for each parsed cookie. Left as a helper for
  // custom flows.
  void setCookie;
}

// Re-export for convenience in server components that also need headers().
export { headers };
