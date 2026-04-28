import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminUsersClient from "./AdminUsersClient";

type Me = { user: { role: string } };

type AdminUser = {
  id: string;
  name: string;
  email: string;
  balance: number;
  pendingBalance: number;
  plan: string;
  role: string;
  frozen: boolean;
  createdAt: string;
  _count: { claims: number; earnings: number; withdrawals: number; referrals: number };
};

type UsersResp = {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const { page: pageStr, search = "" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));

  const qs = new URLSearchParams({ page: String(page) });
  if (search) qs.set("search", search);

  const data = await apiJson<UsersResp>(`/admin/users?${qs.toString()}`);

  return (
    <AdminUsersClient
      users={data?.users ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pages={data?.pages ?? 1}
      search={search}
    />
  );
}
