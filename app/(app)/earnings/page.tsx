import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import EarningsClient from "./EarningsClient";

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const limit = 20;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balance: true, pendingBalance: true },
  });
  if (!user) redirect("/login");

  const [earnings, total] = await prisma.$transaction([
    prisma.earning.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.earning.count({ where: { userId: session.userId } }),
  ]);

  const approvedTotal = await prisma.earning.aggregate({
    where: { userId: session.userId, status: "approved" },
    _sum: { amount: true },
  });

  return (
    <EarningsClient
      earnings={earnings}
      total={total}
      page={page}
      pages={Math.ceil(total / limit)}
      approvedTotal={approvedTotal._sum.amount ?? 0}
      pendingBalance={user.pendingBalance}
    />
  );
}
