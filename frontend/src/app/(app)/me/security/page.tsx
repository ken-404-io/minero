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

type SessionsResp = {
  hasPassword: boolean;
  sessions: Session[];
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

  const res = await fetch(`${serverApiUrl()}/auth/sessions`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) redirect("/login");

  const data = (await res.json()) as SessionsResp;

  return (
    <SecurityClient sessions={data.sessions} hasPassword={data.hasPassword} />
  );
}
