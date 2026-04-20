import { redirect } from "next/navigation";
import Link from "next/link";
import { apiJson } from "@/lib/api";
import {
  IconUsers,
  IconLock,
  IconCoins,
  IconClock,
  IconCalendar,
  IconTrend,
  IconArrowRight,
  IconWallet,
} from "@/components/icons";

type Me = { user: { role: string } };

type PlanDist = { plan: string; _count: { id: number } };

type Stats = {
  totalUsers: number;
  frozenUsers: number;
  activeToday: number;
  totalPaidOut: number;
  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
  pendingPlans: number;
  openAlerts: number;
  todayPayouts: number;
  monthPayouts: number;
  todayImpressions: number;
  monthImpressions: number;
  todayRevenue: number;
  monthRevenue: number;
  todayMargin: number;
  todayRevenueToPayoutRatio: number | null;
  planDistribution: PlanDist[];
};

type PendingWithdrawal = {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  user: { name: string; email: string };
};

type WithdrawalsResp = {
  withdrawals: PendingWithdrawal[];
  total: number;
  page: number;
  pages: number;
};

export default async function AdminDashboard() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const [stats, recent] = await Promise.all([
    apiJson<Stats>("/admin/stats"),
    apiJson<WithdrawalsResp>("/admin/withdrawals?status=pending&page=1"),
  ]);

  const planDist = stats?.planDistribution ?? [];
  const recentWithdrawals = (recent?.withdrawals ?? []).slice(0, 10);
  const pendingCount = stats?.pendingWithdrawals ?? 0;
  const pendingWithdrawalAmount = stats?.pendingWithdrawalAmount ?? 0;
  const frozenUsers = stats?.frozenUsers ?? 0;
  const todayRevenue = stats?.todayRevenue ?? 0;
  const todayPayouts = stats?.todayPayouts ?? 0;
  const todayMargin = stats?.todayMargin ?? 0;
  const ratio = stats?.todayRevenueToPayoutRatio;
  const openAlerts = stats?.openAlerts ?? 0;
  const pendingPlans = stats?.pendingPlans ?? 0;

  const totalPlanUsers = planDist.reduce((s, p) => s + p._count.id, 0) || 1;

  const tiles = [
    { label: "Total users", value: (stats?.totalUsers ?? 0).toLocaleString(), Icon: IconUsers },
    { label: "Active today", value: (stats?.activeToday ?? 0).toLocaleString(), Icon: IconTrend },
    { label: "Frozen accounts", value: frozenUsers.toLocaleString(), Icon: IconLock },
    { label: "Open fraud alerts", value: openAlerts.toLocaleString(), Icon: IconClock },
    { label: "Pending withdrawals", value: pendingCount.toLocaleString(), Icon: IconWallet },
    { label: "Pending plan upgrades", value: pendingPlans.toLocaleString(), Icon: IconCoins },
    { label: "Total paid out", value: `₱${(stats?.totalPaidOut ?? 0).toFixed(2)}`, Icon: IconCoins },
    { label: "Today's payouts", value: `₱${todayPayouts.toFixed(2)}`, Icon: IconCalendar },
  ];

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-6">
          <span className="section-title">Admin</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Overview</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Platform health, user activity, and pending payouts
          </p>
        </header>

        {/* KPI grid — 2 cols mobile, 4 desktop */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          {tiles.map(({ label, value, Icon }) => (
            <div key={label} className="kpi">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                >
                  <Icon size={14} />
                </span>
                <span className="kpi-label">{label}</span>
              </div>
              <span className="kpi-value" style={{ fontSize: "var(--fs-20)" }}>
                {value}
              </span>
            </div>
          ))}
        </section>

        {/* Revenue vs payouts */}
        <section className="card mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-semibold">Revenue vs. payouts (today)</h2>
            <span
              className="badge"
              style={
                todayMargin >= 0
                  ? { background: "var(--success-weak)", color: "var(--success-fg)" }
                  : { background: "var(--danger-weak)", color: "var(--danger-fg)" }
              }
            >
              {todayMargin >= 0 ? "Profitable" : "Losing money"}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Ad revenue (est.)</div>
              <div className="text-xl font-bold font-mono" style={{ color: "var(--success-fg)" }}>
                ₱{todayRevenue.toFixed(2)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {(stats?.todayImpressions ?? 0).toLocaleString()} impressions
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Payouts</div>
              <div className="text-xl font-bold font-mono" style={{ color: "var(--brand)" }}>
                ₱{todayPayouts.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Margin</div>
              <div
                className="text-xl font-bold font-mono"
                style={{ color: todayMargin >= 0 ? "var(--success-fg)" : "var(--danger-fg)" }}
              >
                ₱{todayMargin.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Revenue / payout</div>
              <div className="text-xl font-bold font-mono">
                {ratio ? `${ratio.toFixed(2)}×` : "—"}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Target: ≥ 1.2×
              </div>
            </div>
          </div>
        </section>

        {/* Two-column detail */}
        <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
          {/* Plan distribution */}
          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Plan distribution</h2>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {totalPlanUsers.toLocaleString()} users
              </span>
            </div>
            {planDist.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No data yet
              </p>
            ) : (
              <ul className="space-y-3">
                {planDist.map((p) => {
                  const pct = Math.round((p._count.id / totalPlanUsers) * 100);
                  return (
                    <li key={p.plan}>
                      <div className="flex items-center justify-between mb-1 text-sm">
                        <span className={`badge badge-${p.plan}`}>{p.plan}</span>
                        <span className="font-mono tabular-nums">
                          {p._count.id.toLocaleString()}
                          <span
                            className="ml-2 text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {pct}%
                          </span>
                        </span>
                      </div>
                      <div className="progress">
                        <div className="progress-bar" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Pending withdrawals */}
          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Pending withdrawals</h2>
              <Link
                href="/admin/withdrawals"
                className="link-brand text-sm inline-flex items-center gap-1"
              >
                View all <IconArrowRight size={12} />
              </Link>
            </div>
            {recentWithdrawals.length === 0 ? (
              <div className="py-6 text-center">
                <div
                  aria-hidden
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full mb-2"
                  style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                >
                  <IconWallet size={18} />
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Nothing pending
                </p>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {recentWithdrawals.map((w) => (
                    <li
                      key={w.id}
                      className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{w.user.name}</div>
                        <div
                          className="text-xs font-mono"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {w.method} · {w.accountNumber}
                        </div>
                      </div>
                      <div
                        className="font-mono font-semibold tabular-nums"
                        style={{ color: "var(--brand)" }}
                      >
                        ₱{w.amount.toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-4 pt-3 flex items-center justify-between border-t font-semibold text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--brand)" }}
                >
                  <span>Total pending</span>
                  <span className="font-mono tabular-nums">
                    ₱{pendingWithdrawalAmount.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
