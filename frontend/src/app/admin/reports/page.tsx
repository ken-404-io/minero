import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminReportsClient from "./AdminReportsClient";

type Me = { user: { role: string } };

type Report = {
  id: string;
  userId: string;
  message: string;
  mediaUrl: string | null;
  status: string;
  createdAt: string;
  dismissedAt: string | null;
  dismissedBy: string | null;
  user: { id: string; name: string; email: string } | null;
};

type ReportsResp = {
  reports: Report[];
  total: number;
  page: number;
  pages: number;
};

export default async function AdminReportsPage({
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

  const data = await apiJson<ReportsResp>(
    `/admin/reports?status=${encodeURIComponent(status)}&page=${page}`,
  );

  return (
    <AdminReportsClient
      reports={data?.reports ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pages={data?.pages ?? 1}
      statusFilter={status}
    />
  );
}
