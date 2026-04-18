import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    frozenUsers,
    totalPaidOut,
    pendingWithdrawals,
    todayPayouts,
    monthPayouts,
    planDist,
    recentWithdrawals,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { frozen: true } }),
    prisma.withdrawal.aggregate({ where: { status: "approved" }, _sum: { amount: true } }),
    prisma.withdrawal.findMany({ where: { status: "pending" }, take: 5, orderBy: { requestedAt: "desc" }, include: { user: { select: { name: true, email: true } } } }),
    prisma.earning.aggregate({ where: { createdAt: { gte: startOfDay }, status: "approved" }, _sum: { amount: true } }),
    prisma.earning.aggregate({ where: { createdAt: { gte: startOfMonth }, status: "approved" }, _sum: { amount: true } }),
    prisma.user.groupBy({ by: ["plan"], _count: { id: true }, orderBy: { plan: "asc" } }),
    prisma.withdrawal.findMany({ where: { status: "pending" }, take: 10, orderBy: { requestedAt: "desc" }, include: { user: { select: { name: true } } } }),
  ]);

  const pendingWithdrawalAmount = pendingWithdrawals.reduce((s: number, w: { amount: number }) => s + w.amount, 0);

  const stats = [
    { label: "Total Users", value: totalUsers, icon: "👥" },
    { label: "Frozen Accounts", value: frozenUsers, icon: "🔒" },
    { label: "Total Paid Out", value: `₱${(totalPaidOut._sum.amount ?? 0).toFixed(2)}`, icon: "💰" },
    { label: "Pending Withdrawals", value: pendingWithdrawals.length, icon: "⏳" },
    { label: "Today's Payouts", value: `₱${(todayPayouts._sum.amount ?? 0).toFixed(2)}`, icon: "📅" },
    { label: "Month Payouts", value: `₱${(monthPayouts._sum.amount ?? 0).toFixed(2)}`, icon: "📆" },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-center gap-2 mb-1">
              <span>{s.icon}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
            </div>
            <div className="text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plan distribution */}
        <div className="card">
          <h2 className="font-bold mb-4">Plan Distribution</h2>
          <div className="space-y-2">
            {planDist.map((p) => (
              <div key={p.plan} className="flex justify-between items-center">
                <span className="text-sm">{p.plan}</span>
                <span className="font-bold">{p._count.id} users</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending withdrawals */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Pending Withdrawals</h2>
            <Link href="/admin/withdrawals" className="text-xs hover:underline" style={{ color: "var(--gold)" }}>
              View all →
            </Link>
          </div>
          {recentWithdrawals.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>No pending withdrawals</p>
          ) : (
            <div className="space-y-2">
              {recentWithdrawals.map((w) => (
                <div key={w.id} className="flex justify-between items-center text-sm">
                  <div>
                    <div className="font-medium">{w.user.name}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{w.method} · {w.accountNumber}</div>
                  </div>
                  <div className="font-bold" style={{ color: "var(--gold)" }}>₱{w.amount.toFixed(2)}</div>
                </div>
              ))}
              <div className="pt-2 font-semibold text-sm" style={{ color: "var(--gold)", borderTop: "1px solid var(--border)" }}>
                Total: ₱{pendingWithdrawalAmount.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
