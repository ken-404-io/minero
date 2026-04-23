import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import EarningsClient from "./EarningsClient";

type Me = {
  user: { balance: number; pendingBalance: number };
};

type Earning = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
};

type EarningsResp = {
  earnings: Earning[];
  total: number;
  page: number;
  pages: number;
  approvedTotal: number;
};

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));

  const [me, earningsResp] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<EarningsResp>(`/earnings?page=${page}`),
  ]);

  if (!me) redirect("/login");

  const earnings = earningsResp?.earnings ?? [];
  const total = earningsResp?.total ?? 0;
  const pages = earningsResp?.pages ?? 1;
  const approvedTotal = earningsResp?.approvedTotal ?? 0;

  return (
    <EarningsClient
      earnings={earnings}
      total={total}
      page={page}
      pages={pages}
      approvedTotal={approvedTotal}
      pendingBalance={me.user.pendingBalance}
    />
  );
}
