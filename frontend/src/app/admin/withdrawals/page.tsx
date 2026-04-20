import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminWithdrawalsClient from "./AdminWithdrawalsClient";

type Me = { user: { role: string } };

type AdminWithdrawal = {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  adminNote: string | null;
  user: { name: string; email: string };
};

type WithdrawalsResp = {
  withdrawals: AdminWithdrawal[];
  total: number;
  page: number;
  pages: number;
};

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const { page: pageStr, status = "pending" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));

  const qs = new URLSearchParams({ page: String(page), status });
  const data = await apiJson<WithdrawalsResp>(`/admin/withdrawals?${qs.toString()}`);

  return (
    <AdminWithdrawalsClient
      withdrawals={data?.withdrawals ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pages={data?.pages ?? 1}
      statusFilter={status}
    />
  );
}
