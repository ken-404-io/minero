import { redirect } from "next/navigation";
import { apiJson } from "@/lib/api";
import { IconActivity, IconUsers } from "@/components/icons";

type Me = { user: { role: string } };

type OnlineUser = {
  id: string;
  name: string;
  email: string;
  plan: string;
  balance: number;
  lastSeenAt: string;
};

type OnlineResp = { users: OnlineUser[]; total: number };

function secsAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export const revalidate = 0;

export default async function AdminOnlinePage() {
  const me = await apiJson<Me>("/auth/me");
  if (!me) redirect("/login");
  if (me.user.role !== "admin") redirect("/dashboard");

  const data = await apiJson<OnlineResp>("/admin/online");
  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
        <header className="mb-6">
          <span className="section-title">Admin</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1 flex items-center gap-3">
            Online now
            <span
              className="inline-flex items-center gap-1.5 text-base font-semibold px-3 py-1 rounded-full"
              style={{ background: "var(--success-weak)", color: "var(--success-fg)" }}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full animate-pulse"
                style={{ background: "var(--success-fg)" }}
              />
              {total}
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Users active in the last 2 minutes · refreshes on each page load
          </p>
        </header>

        {users.length === 0 ? (
          <div className="card text-center py-16">
            <div
              aria-hidden
              className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-3"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              <IconActivity size={22} />
            </div>
            <p className="font-medium">No users online right now</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Users appear here within 60 seconds of opening the app.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <section className="card hidden lg:block" style={{ padding: 0, overflow: "hidden" }}>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Plan</th>
                      <th>Balance</th>
                      <th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-block h-2 w-2 rounded-full animate-pulse flex-shrink-0"
                              style={{ background: "var(--success-fg)" }}
                            />
                            <div>
                              <div className="font-medium">{u.name}</div>
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className={`badge badge-${u.plan}`}>{u.plan}</span></td>
                        <td>
                          <span className="font-mono font-semibold" style={{ color: "var(--brand)" }}>
                            ₱{u.balance.toFixed(2)}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: "var(--text-muted)" }}>
                          {secsAgo(u.lastSeenAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Mobile list */}
            <section className="lg:hidden flex flex-col gap-3">
              {users.map((u) => (
                <article key={u.id} className="card">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full animate-pulse flex-shrink-0"
                      style={{ background: "var(--success-fg)" }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.name}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{u.email}</div>
                    </div>
                    <span className={`badge badge-${u.plan} ml-auto`}>{u.plan}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono font-semibold" style={{ color: "var(--brand)" }}>
                      ₱{u.balance.toFixed(2)}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{secsAgo(u.lastSeenAt)}</span>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        {/* Legend */}
        <p className="text-xs mt-6 text-center" style={{ color: "var(--text-subtle)" }}>
          <IconUsers size={12} style={{ display: "inline", marginRight: 4 }} />
          Online indicator = heartbeat within the last 2 minutes. Users without the app open will drop off automatically.
        </p>
      </div>
    </div>
  );
}
