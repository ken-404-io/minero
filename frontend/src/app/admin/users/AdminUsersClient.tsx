"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_URL } from "@/lib/api-url";
import {
  IconSearch,
  IconArrowLeft,
  IconArrowRight,
  IconShield,
  IconLock,
  IconCheck,
  IconX,
  IconUser,
  IconWallet,
  IconPickaxe,
  IconChevronRight,
  IconInfo,
} from "@/components/icons";

type User = {
  id: string;
  name: string;
  email: string;
  balance: number;
  pendingBalance: number;
  plan: string;
  role: string;
  frozen: boolean;
  createdAt: string | Date;
  _count: { claims: number; earnings: number; withdrawals: number; referralsGiven: number };
};

type Claim = { id: string; amount: number; claimedAt: string };
type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  adminNote: string | null;
};

type UserDetail = {
  user: User & { legacyImported: boolean; legacyImportedCoins: number };
  recentClaims: Claim[];
  recentWithdrawals: Withdrawal[];
};

type Props = {
  users: User[];
  total: number;
  page: number;
  pages: number;
  search: string;
};

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminUsersClient({ users, total, page, pages, search }: Props) {
  const router = useRouter();
  const [searchVal, setSearchVal] = useState(search);
  const [loading, setLoading] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<UserDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/admin/users?search=${encodeURIComponent(searchVal)}`);
  }

  async function openDrawer(userId: string) {
    setDrawerLoading(true);
    setDrawer(null);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        credentials: "include",
      });
      const data = await res.json();
      setDrawer(data as UserDetail);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setDrawer(null);
  }

  async function patchUser(userId: string, payload: Record<string, unknown>) {
    setLoading(userId);
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && drawer && data.user) {
        setDrawer((d) =>
          d ? { ...d, user: { ...d.user, ...data.user } } : null
        );
        router.refresh();
      }
      return res.ok;
    } finally {
      setLoading(null);
    }
  }

  const empty = users.length === 0;

  return (
    <>
      <div className="w-full">
        <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-8">
          <header className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <span className="section-title">Admin</span>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
                Users <span style={{ color: "var(--text-muted)" }}>({total.toLocaleString()})</span>
              </h1>
            </div>
            <form onSubmit={doSearch} className="flex gap-2">
              <div className="relative flex-1 lg:w-72">
                <IconSearch
                  size={16}
                  style={{ position: "absolute", left: 12, top: 14, color: "var(--text-subtle)" }}
                />
                <input
                  className="input"
                  style={{ paddingLeft: 36 }}
                  placeholder="Search name or email…"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  aria-label="Search users"
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>
          </header>

          {empty ? (
            <div className="card text-center py-12" style={{ color: "var(--text-muted)" }}>
              No users match your search.
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
                        <th>Claims</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {u.email}
                            </div>
                            <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                              Joined {fmtDate(u.createdAt)}
                            </div>
                          </td>
                          <td><span className={`badge badge-${u.plan}`}>{u.plan}</span></td>
                          <td>
                            <div className="font-mono font-semibold tabular-nums">
                              ₱{u.balance.toFixed(2)}
                            </div>
                            <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                              +₱{u.pendingBalance.toFixed(2)} pending
                            </div>
                          </td>
                          <td className="font-mono tabular-nums">{u._count.claims}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {u.frozen ? (
                                <span className="badge badge-rejected">
                                  <IconLock size={12} /> Frozen
                                </span>
                              ) : (
                                <span className="badge badge-approved">
                                  <IconCheck size={12} /> Active
                                </span>
                              )}
                              {u.role === "admin" && (
                                <span className="badge badge-paid">
                                  <IconShield size={12} /> Admin
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => openDrawer(u.id)}
                              className="btn btn-secondary btn-sm"
                            >
                              Manage
                            </button>
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                          {u.email}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                        {u.frozen ? (
                          <span className="badge badge-rejected">
                            <IconLock size={12} /> Frozen
                          </span>
                        ) : (
                          <span className="badge badge-approved">
                            <IconCheck size={12} /> Active
                          </span>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 mt-3 text-sm">
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Balance</dt>
                        <dd className="font-mono font-semibold">₱{u.balance.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Pending</dt>
                        <dd className="font-mono" style={{ color: "var(--text-muted)" }}>
                          ₱{u.pendingBalance.toFixed(2)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>Claims</dt>
                        <dd className="font-mono">{u._count.claims}</dd>
                      </div>
                    </dl>
                    <button
                      onClick={() => openDrawer(u.id)}
                      className="mt-3 btn btn-secondary btn-sm w-full flex items-center justify-center gap-2"
                    >
                      Manage <IconChevronRight size={14} />
                    </button>
                  </article>
                ))}
              </section>
            </>
          )}

          {pages > 1 && <Pagination page={page} pages={pages} search={search} />}
        </div>
      </div>

      {/* User detail drawer */}
      {(drawerLoading || drawer) && (
        <UserDrawer
          detail={drawer}
          loading={drawerLoading || loading !== null}
          onClose={closeDrawer}
          onPatch={patchUser}
        />
      )}
    </>
  );
}

// ============================================================
//  User detail drawer
// ============================================================

function UserDrawer({
  detail,
  loading,
  onClose,
  onPatch,
}: {
  detail: UserDetail | null;
  loading: boolean;
  onClose: () => void;
  onPatch: (userId: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<"overview" | "claims" | "withdrawals">("overview");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const u = detail?.user;

  async function handleAction(payload: Record<string, unknown>) {
    if (!u) return;
    setSaving(true);
    setMsg("");
    const ok = await onPatch(u.id, payload);
    if (ok) setMsg("Saved.");
    else setMsg("Error — changes may not have saved.");
    setSaving(false);
  }

  async function applyBalance() {
    const n = parseFloat(balanceAmount);
    if (!Number.isFinite(n) || n === 0) {
      setMsg("Enter a non-zero amount.");
      return;
    }
    await handleAction({ balanceAdjustment: n, balanceReason });
    setBalanceAmount("");
    setBalanceReason("");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(100vw, 520px)",
          background: "var(--bg-elevated)",
          borderLeft: "1px solid var(--border-strong)",
          overflowY: "auto",
        }}
        aria-label="User detail"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="font-semibold text-base">
            {u ? u.name : "Loading…"}
          </h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        {loading && !detail && (
          <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        )}

        {u && (
          <>
            {/* Status badges + meta */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                {u.frozen ? (
                  <span className="badge badge-rejected"><IconLock size={12} /> Frozen</span>
                ) : (
                  <span className="badge badge-approved"><IconCheck size={12} /> Active</span>
                )}
                {u.role === "admin" && (
                  <span className="badge badge-paid"><IconShield size={12} /> Admin</span>
                )}
              </div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>{u.email}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Joined {fmtDate(u.createdAt)} · ID: {u.id.slice(0, 8)}…
              </div>
            </div>

            {/* Balance summary */}
            <div
              className="grid grid-cols-3 px-5 py-3 text-center"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
            >
              <div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Balance</div>
                <div className="font-mono font-bold">₱{u.balance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Pending</div>
                <div className="font-mono">₱{u.pendingBalance.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Claims</div>
                <div className="font-mono">{u._count.claims}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0" style={{ borderBottom: "1px solid var(--border)" }}>
              {(["overview", "claims", "withdrawals"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-3 text-sm font-medium capitalize"
                  style={{
                    borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
                    color: tab === t ? "var(--brand)" : "var(--text-muted)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {msg && (
              <div
                className="mx-5 mt-4 px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                <IconInfo size={14} style={{ display: "inline", marginRight: 6 }} />
                {msg}
              </div>
            )}

            {tab === "overview" && (
              <div className="flex flex-col gap-5 px-5 py-5">
                {/* Balance adjustment */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Adjust balance</h3>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount (+ add, − deduct)"
                      className="input flex-1"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                    />
                    <button
                      onClick={applyBalance}
                      disabled={saving}
                      className="btn btn-primary btn-sm"
                    >
                      Apply
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Reason (optional, recorded in audit log)"
                    className="input w-full text-sm"
                    value={balanceReason}
                    onChange={(e) => setBalanceReason(e.target.value)}
                  />
                </section>

                {/* Plan override */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Plan</h3>
                  <div className="flex gap-2">
                    {(["free", "paid"] as const).map((p) => (
                      <button
                        key={p}
                        disabled={saving || u.plan === p}
                        onClick={() => handleAction({ plan: p })}
                        className={`btn btn-sm ${u.plan === p ? "btn-primary" : "btn-secondary"}`}
                      >
                        {p === "free" ? "Free (with ads)" : "Paid (ad-free)"}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Role */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Role</h3>
                  <div className="flex gap-2">
                    {(["user", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        disabled={saving || u.role === r}
                        onClick={() => handleAction({ role: r })}
                        className={`btn btn-sm ${u.role === r ? "btn-primary" : "btn-secondary"}`}
                      >
                        {r === "admin" ? "Admin" : "Regular user"}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Freeze / unfreeze */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Account status</h3>
                  {u.frozen ? (
                    <button
                      disabled={saving}
                      onClick={() => handleAction({ frozen: false })}
                      className="btn btn-success btn-sm"
                    >
                      Unfreeze account
                    </button>
                  ) : (
                    <button
                      disabled={saving}
                      onClick={() => handleAction({ frozen: true })}
                      className="btn btn-danger btn-sm"
                    >
                      Freeze account
                    </button>
                  )}
                  <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
                    Freezing cancels all pending withdrawals and blocks the user from claiming.
                  </p>
                </section>

                {/* Stats */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Account stats</h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["Total claims", u._count.claims],
                      ["Total earnings", u._count.earnings],
                      ["Withdrawals", u._count.withdrawals],
                      ["Referrals", u._count.referralsGiven],
                    ].map(([label, val]) => (
                      <div
                        key={String(label)}
                        className="rounded-lg px-3 py-2"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <dt className="text-xs" style={{ color: "var(--text-subtle)" }}>{label}</dt>
                        <dd className="font-mono font-semibold">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            )}

            {tab === "claims" && (
              <div className="px-5 py-5">
                <h3 className="text-sm font-semibold mb-3">Recent claims (last 20)</h3>
                {detail?.recentClaims.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No claims yet.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {detail?.recentClaims.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <div style={{ color: "var(--text-muted)" }}>
                          <IconPickaxe size={12} style={{ display: "inline", marginRight: 6 }} />
                          {fmtDateTime(c.claimedAt)}
                        </div>
                        <div className="font-mono font-semibold">+₱{c.amount.toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "withdrawals" && (
              <div className="px-5 py-5">
                <h3 className="text-sm font-semibold mb-3">Recent withdrawals (last 20)</h3>
                {detail?.recentWithdrawals.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>No withdrawals yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {detail?.recentWithdrawals.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-lg px-3 py-3 text-sm"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-mono font-semibold">₱{w.amount.toFixed(2)}</div>
                          <span
                            className={`badge badge-${
                              w.status === "approved"
                                ? "approved"
                                : w.status === "rejected"
                                ? "rejected"
                                : "free"
                            }`}
                          >
                            {w.status}
                          </span>
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                          {w.method.toUpperCase()} · {w.accountNumber}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                          {fmtDateTime(w.requestedAt)}
                          {w.adminNote && (
                            <span className="ml-2">— {w.adminNote}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}

function Pagination({ page, pages, search }: { page: number; pages: number; search: string }) {
  return (
    <nav className="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
      <Link
        aria-label="Previous page"
        aria-disabled={page <= 1}
        href={`/admin/users?page=${Math.max(1, page - 1)}&search=${encodeURIComponent(search)}`}
        className="btn btn-icon"
        style={page <= 1 ? { pointerEvents: "none", opacity: 0.4 } : {}}
      >
        <IconArrowLeft size={16} />
      </Link>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link
          key={p}
          href={`/admin/users?page=${p}&search=${encodeURIComponent(search)}`}
          aria-current={p === page ? "page" : undefined}
          className="h-9 min-w-9 px-2 flex items-center justify-center rounded-md text-sm font-medium"
          style={
            p === page
              ? { background: "var(--brand)", color: "var(--brand-fg)" }
              : { background: "var(--surface-2)", color: "var(--text)" }
          }
        >
          {p}
        </Link>
      ))}
      <Link
        aria-label="Next page"
        aria-disabled={page >= pages}
        href={`/admin/users?page=${Math.min(pages, page + 1)}&search=${encodeURIComponent(search)}`}
        className="btn btn-icon"
        style={page >= pages ? { pointerEvents: "none", opacity: 0.4 } : {}}
      >
        <IconArrowRight size={16} />
      </Link>
    </nav>
  );
}
