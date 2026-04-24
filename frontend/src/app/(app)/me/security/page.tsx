import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { serverApiUrl } from "@/lib/api";
import SecurityClient from "./SecurityClient";

type Session = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  isCurrent: boolean;
};

type HistoryEntry = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string;
};

type SessionsResp = {
  hasPassword: boolean;
  userEmail: string;
  sessions: Session[];
};

type HistoryResp = {
  history: HistoryEntry[];
};

export default async function SecurityPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const refreshCookie = cookieStore.get("refresh_token")?.value;

  if (!sessionCookie) redirect("/login");

  const cookieHeader = [
    `session=${sessionCookie}`,
    refreshCookie && `refresh_token=${refreshCookie}`,
  ]
    .filter(Boolean)
    .join("; ");

  const [sessionsRes, historyRes] = await Promise.all([
    fetch(`${serverApiUrl()}/auth/sessions`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
    fetch(`${serverApiUrl()}/auth/login-history`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
  ]);

  if (!sessionsRes.ok) redirect("/login");

  const sessionsData = (await sessionsRes.json()) as SessionsResp;
  const historyData = historyRes.ok
    ? ((await historyRes.json()) as HistoryResp)
    : { history: [] };

  return (
    <SecurityClient
      sessions={sessionsData.sessions}
      hasPassword={sessionsData.hasPassword}
      userEmail={sessionsData.userEmail}
      loginHistory={historyData.history}
    />
  );
}
