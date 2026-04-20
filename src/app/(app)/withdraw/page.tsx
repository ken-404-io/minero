import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";
import { redirect } from "next/navigation";
import WithdrawClient from "./WithdrawClient";
import { WITHDRAWAL_MINIMUM } from "@/backend/lib/mining";

export default async function WithdrawPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { balance: true, pendingBalance: true },
  });
  if (!user) redirect("/login");

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.userId },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <WithdrawClient
      balance={user.balance}
      pendingBalance={user.pendingBalance}
      withdrawals={withdrawals}
      minimum={WITHDRAWAL_MINIMUM}
    />
  );
}
