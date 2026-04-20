import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import WithdrawClient from "./WithdrawClient";
import { WITHDRAWAL_MINIMUM } from "@/lib/mining";

type Me = {
  user: { balance: number; pendingBalance: number };
};

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
};

type WithdrawalsResp = {
  withdrawals: Withdrawal[];
};

export default async function WithdrawPage() {
  const [me, data] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<WithdrawalsResp>("/withdraw"),
  ]);

  if (!me) redirect("/login");

  return (
    <WithdrawClient
      balance={me.user.balance}
      pendingBalance={me.user.pendingBalance}
      withdrawals={data?.withdrawals ?? []}
      minimum={WITHDRAWAL_MINIMUM}
    />
  );
}
