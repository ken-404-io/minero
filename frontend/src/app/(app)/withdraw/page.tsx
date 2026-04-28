import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import WithdrawClient from "./WithdrawClient";

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

type PublicConfig = {
  plans: Record<string, unknown>;
  claimIntervalMs: number;
  withdrawalMinimum: number;
  withdrawalsEnabled?: boolean;
};

export default async function WithdrawPage() {
  const [me, data, configData] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<WithdrawalsResp>("/withdraw"),
    apiJson<PublicConfig>("/config"),
  ]);

  if (!me) redirect("/login");

  return (
    <WithdrawClient
      balance={me.user.balance}
      pendingBalance={me.user.pendingBalance}
      withdrawals={data?.withdrawals ?? []}
      minimum={configData?.withdrawalMinimum ?? 300}
      withdrawalsEnabled={configData?.withdrawalsEnabled ?? true}
    />
  );
}
