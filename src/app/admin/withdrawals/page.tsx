import { prisma } from "@/backend/lib/db";
import { getSession } from "@/backend/lib/auth";
import { redirect } from "next/navigation";
import AdminWithdrawalsClient from "./AdminWithdrawalsClient";

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const { page: pageStr, status = "pending" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const limit = 20;

  const where = status === "all" ? {} : { status };

  const [withdrawals, total] = await prisma.$transaction([
    prisma.withdrawal.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.withdrawal.count({ where }),
  ]);

  return (
    <AdminWithdrawalsClient
      withdrawals={withdrawals}
      total={total}
      page={page}
      pages={Math.ceil(total / limit)}
      statusFilter={status}
    />
  );
}
