import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminPlansClient from "./AdminPlansClient";

type Me = { user: { role: string } };

type PlanLog = {
  id: string;
  userId: string;
  plan: string;
  amountPaid: number;
  paymentRef: string | null;
  paymentProvider: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
  user: { name: string; email: string; plan: string } | null;
};

type Resp = {
  plans: PlanLog[];
  total: number;
  page: number;
  pages: number;
};

export default async function AdminPlansQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const status = sp.status ?? "pending";
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const data = await apiJson<Resp>(
    `/admin/plans?status=${encodeURIComponent(status)}&page=${page}`,
  );

  return (
    <AdminPlansClient
      plans={data?.plans ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pages={data?.pages ?? 1}
      statusFilter={status}
    />
  );
}
