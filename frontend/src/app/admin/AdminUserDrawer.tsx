"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import {
  IconShield, IconLock, IconCheck, IconX, IconUser,
  IconWallet, IconPickaxe, IconInfo, IconUsers,
} from "@/components/icons";

const REFERRAL_REQUIRED = 50;

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(d: string | Date) {
  return new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Claim = { id: string; amount: number; claimedAt: string };
type Withdrawal = {
  id: string; amount: number; method: string; accountNumber: string;
  status: string; requestedAt: string; processedAt: string | null; adminNote: string | null;
};

type UserDetail = {
  user: {
    id: string; name: string; email: string; balance: number; pendingBalance: number;
    gameCoinsBalance?: number; plan: string; role: string; frozen: boolean;
    createdAt: string | Date; withdrawGateUnlockedAt: string | Date | null;
    withdrawGateReferrals?: number;
    legacyImported: boolean; legacyImportedCoins: number;
    _count: { claims: number; earnings: number; withdrawals: number; referralsGiven: number };
  };
  recentClaims: Claim[];
  recentWithdrawals: Withdrawal[];
};

type Props = {
  userId: string | null;
  onClose: () => void;
};

export default function AdminUserDrawer({ userId, onClose }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [tab, setTab] = useState<"overview" | "claims" | "withdrawals">("overview");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceReason, setBalanceReason] = useState("");
  const [coinsAmount, setCoinsAmount] = useState("");
  const [coinsReason, setCoinsReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!userId) { setDetail(null); return; }
    setLoadingDetail(true);
    setDetail(null);
    setTab("overview");
    setMsg("");
    fetch(`${API_URL}/admin/users/${userId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setDetail(d as UserDetail))
      .catch(() => setMsg("Failed to load user."))
      .finally(() => setLoadingDetail(false));
  }, [userId]);

  async function patch(payload: Record<string, unknown>) {
    if (!userId) return false;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setDetail((d) => d ? { ...d, user: { ...d.user, ...data.user } } : null);
        router.refresh();
        return true;
      }
      setMsg("Error saving changes.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(payload: Record<string, unknown>) {
    const ok = await patch(payload);
    if (ok) setMsg("Saved.");
    else setMsg("Error — changes may not have saved.");
  }

  async function applyBalance() {
    const n = parseFloat(balanceAmount);
    if (!Number.isFinite(n) || n === 0) { setMsg("Enter a non-zero amount."); return; }
    await handleAction({ balanceAdjustment: n, balanceReason });
    setBalanceAmount(""); setBalanceReason("");
  }

  async function applyCoins() {
    const n = parseInt(coinsAmount, 10);
    if (!Number.isFinite(n) || n === 0) { setMsg("Enter a non-zero whole number."); return; }
    await handleAction({ gameCoinsAdjustment: n, gameCoinsReason: coinsReason });
    setCoinsAmount(""); setCoinsReason("");
  }

  if (!userId) return null;

  const u = detail?.user;
  const gateReferrals = u?.withdrawGateReferrals ?? 0;
  const gateComplete = gateReferrals >= REFERRAL_REQUIRED;
  const gatePct = Math.min(100, (gateReferrals / REFERRAL_REQUIRED) * 100);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} aria-hidden />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{ width: "min(100vw, 520px)", background: "var(--bg-elevated)", borderLeft: "1px solid var(--border-strong)", overflowY: "auto" }}
        aria-label="User detail"
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-base">{u ? u.name : "Loading…"}</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close"><IconX size={18} /></button>
        </div>

        {loadingDetail && !detail && (
          <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>Loading…</div>
        )}

        {u && (
          <>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`badge badge-${u.plan}`}>{u.plan}</span>
                {u.frozen
                  ? <span className="badge badge-rejected"><IconLock size={12} /> Frozen</span>
                  : <span className="badge badge-approved"><IconCheck size={12} /> Active</span>}
                {u.role === "admin" && <span className="badge badge-paid"><IconShield size={12} /> Admin</span>}
              </div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>{u.email}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                Joined {fmtDate(u.createdAt)} · ID: {u.id.slice(0, 8)}…
              </div>
            </div>

            <div className="grid grid-cols-3 px-5 py-3 text-center" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
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

            <div className="flex gap-0" style={{ borderBottom: "1px solid var(--border)" }}>
              {(["overview", "claims", "withdrawals"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className="flex-1 py-3 text-sm font-medium capitalize"
                  style={{ borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent", color: tab === t ? "var(--brand)" : "var(--text-muted)" }}>
                  {t}
                </button>
              ))}
            </div>

            {msg && (
              <div className="mx-5 mt-4 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                <IconInfo size={14} style={{ display: "inline", marginRight: 6 }} />{msg}
              </div>
            )}

            {tab === "overview" && (
              <div className="flex flex-col gap-5 px-5 py-5">
                {/* Cash balance */}
                <section>
                  <h3 className="text-sm font-semibold mb-1">Adjust cash balance</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>
                    Current: <span className="font-mono font-semibold">₱{(u.balance ?? 0).toFixed(2)}</span>
                    {" · "}Pending: <span className="font-mono">₱{u.pendingBalance.toFixed(2)}</span>
                  </p>
                  <div className="flex gap-2 mb-2">
                    <input type="number" step="0.01" placeholder="Amount (+ add, − deduct)" className="input flex-1"
                      value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} />
                    <button onClick={applyBalance} disabled={saving} className="btn btn-primary btn-sm">Apply</button>
                  </div>
                  <input type="text" placeholder="Reason (optional, recorded in audit log)" className="input w-full text-sm"
                    value={balanceReason} onChange={(e) => setBalanceReason(e.target.value)} />
                </section>

                {/* Game coins */}
                <section>
                  <h3 className="text-sm font-semibold mb-1">Adjust game coins</h3>
                  <p className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>
                    Current: <span className="font-mono font-semibold">{(u.gameCoinsBalance ?? 0).toLocaleString()} coins</span>
                  </p>
                  <div className="flex gap-2 mb-2">
                    <input type="number" step="1" placeholder="Coins (+ add, − deduct)" className="input flex-1"
                      value={coinsAmount} onChange={(e) => setCoinsAmount(e.target.value)} />
                    <button onClick={applyCoins} disabled={saving} className="btn btn-primary btn-sm">Apply</button>
                  </div>
                  <input type="text" placeholder="Reason (optional)" className="input w-full text-sm"
                    value={coinsReason} onChange={(e) => setCoinsReason(e.target.value)} />
                </section>

                {/* Withdrawal gate */}
                <section>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <IconUsers size={14} /> Withdrawal gate
                    {gateComplete
                      ? <span className="badge badge-approved text-xs">Complete</span>
                      : <span className="badge badge-free text-xs">Locked</span>}
                  </h3>
                  <div className="rounded-lg p-3 mb-3 text-xs" style={{ background: "var(--surface-2)" }}>
                    <div className="flex justify-between mb-1.5">
                      <span style={{ color: "var(--text-muted)" }}>Post-unlock referrals</span>
                      <span className="font-mono font-semibold">{gateReferrals}/{REFERRAL_REQUIRED}</span>
                    </div>
                    <div className="progress mb-2">
                      <div className="progress-bar" style={{ width: `${gatePct}%` }} />
                    </div>
                    <div className="flex justify-between" style={{ color: "var(--text-subtle)" }}>
                      <span>Gate unlocked at</span>
                      <span className="font-mono">
                        {u.withdrawGateUnlockedAt ? fmtDate(u.withdrawGateUnlockedAt) : "Not unlocked"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={saving} onClick={() => handleAction({ resetWithdrawGate: true })}
                      className="btn btn-secondary btn-sm" title="Sets gate to null — user must reach ₱300 again">
                      Reset gate
                    </button>
                    <button disabled={saving} onClick={() => handleAction({ unlockWithdrawGate: true })}
                      className="btn btn-secondary btn-sm" title="Stamps gate unlock to now — referrals from today onwards count">
                      Unlock from today
                    </button>
                    <button disabled={saving} onClick={() => handleAction({ forceCompleteGate: true })}
                      className="btn btn-primary btn-sm" title="Sets gate to epoch — all of the user's referrals count, gate becomes complete immediately">
                      Force complete
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
                    Force complete counts all past referrals. Reset clears the gate entirely.
                  </p>
                </section>

                {/* Role */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Role</h3>
                  <div className="flex gap-2">
                    {(["user", "admin"] as const).map((r) => (
                      <button key={r} disabled={saving || u.role === r} onClick={() => handleAction({ role: r })}
                        className={`btn btn-sm ${u.role === r ? "btn-primary" : "btn-secondary"}`}>
                        {r === "admin" ? "Admin" : "Regular user"}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Freeze */}
                <section>
                  <h3 className="text-sm font-semibold mb-3">Account status</h3>
                  {u.frozen ? (
                    <button disabled={saving} onClick={() => handleAction({ frozen: false })} className="btn btn-success btn-sm">
                      Unfreeze account
                    </button>
                  ) : (
                    <button disabled={saving} onClick={() => handleAction({ frozen: true })} className="btn btn-danger btn-sm">
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
                      <div key={String(label)} className="rounded-lg px-3 py-2" style={{ background: "var(--surface-2)" }}>
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
                {detail?.recentClaims.length === 0
                  ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No claims yet.</p>
                  : <div className="flex flex-col gap-1">
                    {detail?.recentClaims.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)" }}>
                        <div style={{ color: "var(--text-muted)" }}>
                          <IconPickaxe size={12} style={{ display: "inline", marginRight: 6 }} />
                          {fmtDateTime(c.claimedAt)}
                        </div>
                        <div className="font-mono font-semibold">+₱{c.amount.toFixed(4)}</div>
                      </div>
                    ))}
                  </div>}
              </div>
            )}

            {tab === "withdrawals" && (
              <div className="px-5 py-5">
                <h3 className="text-sm font-semibold mb-3">Recent withdrawals (last 20)</h3>
                {detail?.recentWithdrawals.length === 0
                  ? <p className="text-sm" style={{ color: "var(--text-muted)" }}>No withdrawals yet.</p>
                  : <div className="flex flex-col gap-2">
                    {detail?.recentWithdrawals.map((w) => (
                      <div key={w.id} className="rounded-lg px-3 py-3 text-sm" style={{ background: "var(--surface-2)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-mono font-semibold">₱{w.amount.toFixed(2)}</div>
                          <span className={`badge badge-${w.status === "approved" ? "approved" : w.status === "rejected" ? "rejected" : "free"}`}>
                            {w.status}
                          </span>
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>{w.method.toUpperCase()} · {w.accountNumber}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-subtle)" }}>
                          {fmtDateTime(w.requestedAt)}{w.adminNote && <span className="ml-2">— {w.adminNote}</span>}
                        </div>
                      </div>
                    ))}
                  </div>}
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
