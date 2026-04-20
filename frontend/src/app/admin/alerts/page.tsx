import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminAlertsClient from "./AdminAlertsClient";

type Me = { user: { role: string } };

type Alert = {
  id: string;
  userId: string | null;
  type: string;
  severity: string;
  details: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  adminNote: string | null;
  user: { id: string; name: string; email: string; frozen: boolean } | null;
};

type AlertsResp = {
  alerts: Alert[];
  total: number;
  page: number;
  pages: number;
};

export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const status = sp.status ?? "open";
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const data = await apiJson<AlertsResp>(
    `/admin/fraud-alerts?status=${encodeURIComponent(status)}&page=${page}`,
  );

  return (
    <AdminAlertsClient
      alerts={data?.alerts ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pages={data?.pages ?? 1}
      statusFilter={status}
    />
  );
}
