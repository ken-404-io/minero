import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";

type Me = { user: { role: string } };

type PlanLog = {
  id: string;
  userId: string;
  plan: string;
  amountPaid: number;
  paymentRef: string | null;
  paymentProvider: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
  user: { name: string; email: string; plan: string } | null;
};

type Resp = {
  plans: PlanLog[];
  total: number;
  page: number;
  pages: number;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default async function AdminPaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const status = sp.status ?? "all";
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const data = await apiJson<Resp>(
    `/admin/plans?status=${encodeURIComponent(status)}&page=${page}`,
  );
  const rows = data?.plans ?? [];

  return (
    <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
      <header className="mb-6">
        <span className="section-title">Admin</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Payment history
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Read-only log of ₱49 activation payments processed via PayMongo.
        </p>
      </header>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Reference</th>
                <th>Created</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center" style={{ color: "var(--text-muted)" }}>
                    No payments on record.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.user?.name ?? "—"}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {p.user?.email ?? p.userId}
                      </div>
                    </td>
                    <td><span className={`badge badge-${p.plan}`}>{p.plan}</span></td>
                    <td className="font-mono tabular-nums">₱{p.amountPaid.toFixed(2)}</td>
                    <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                    <td className="text-xs">{p.paymentProvider ?? "—"}</td>
                    <td className="font-mono text-xs">{p.paymentRef ?? "—"}</td>
                    <td className="text-xs">{formatDate(p.createdAt)}</td>
                    <td className="text-xs">{formatDate(p.reviewedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <nav className="mt-4 text-sm" aria-label="Filter">
        <span style={{ color: "var(--text-muted)" }}>Filter: </span>
        {["all", "pending", "approved", "rejected"].map((s) => (
          <a
            key={s}
            href={`/admin/payments?status=${s}`}
            className={`btn btn-sm ${status === s ? "btn-primary" : "btn-ghost"}`}
            style={{ marginRight: 4 }}
          >
            {s}
          </a>
        ))}
      </nav>
    </div>
  );
}
