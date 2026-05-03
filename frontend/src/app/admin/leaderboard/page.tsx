import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import AdminLeaderboardClient from "./AdminLeaderboardClient";

type Me = { user: { role: string } };

type LeaderboardUser = {
  id: string;
  name: string;
  email: string;
  plan: string;
  balance: number;
  pendingBalance: number;
  frozen: boolean;
  lastSeenAt: string | null;
  createdAt: string;
};

type LeaderboardResp = {
  users: LeaderboardUser[];
  total: number;
  page: number;
  pages: number;
};

export const revalidate = 0;

export default async function AdminLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1"));

  const data = await apiJson<LeaderboardResp>(`/admin/leaderboard?page=${page}`);

  return (
    <AdminLeaderboardClient
      users={data?.users ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pages={data?.pages ?? 1}
    />
  );
}
