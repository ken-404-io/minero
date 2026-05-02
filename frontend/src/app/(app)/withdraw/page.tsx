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

export type GateStatus = {
  balanceQualifies: boolean;
  gateUnlockedAt: string | null;
  referralsMade: number;
  referralsRequired: number;
  gateComplete: boolean;
  canWithdraw: boolean;
};

export default async function WithdrawPage() {
  const [me, data, configData, gate] = await Promise.all([
    apiJson<Me>("/auth/me"),
    apiJson<WithdrawalsResp>("/withdraw"),
    apiJson<PublicConfig>("/config"),
    apiJson<GateStatus>("/withdraw/gate"),
  ]);

  if (!me) redirect("/login");

  return (
    <WithdrawClient
      balance={me.user.balance}
      pendingBalance={me.user.pendingBalance}
      withdrawals={data?.withdrawals ?? []}
      minimum={configData?.withdrawalMinimum ?? 300}
      withdrawalsEnabled={configData?.withdrawalsEnabled ?? true}
      gate={gate ?? {
        balanceQualifies: false,
        gateUnlockedAt: null,
        referralsMade: 0,
        referralsRequired: 50,
        gateComplete: false,
        canWithdraw: false,
      }}
    />
  );
}
