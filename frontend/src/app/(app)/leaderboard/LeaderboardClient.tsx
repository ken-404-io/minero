"use client";

import { useState } from "react";
import { IconPickaxe, IconTrophy, IconUsers } from "@/components/icons";

type Miner = { rank: number; name: string; amount: number };
type Referrer = { rank: number; name: string; count: number };

type Props = {
  miners: Miner[];
  referrers: Referrer[];
  updatedAt: string | null;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) return <span className="text-xl leading-none">{MEDALS[rank - 1]}</span>;
  return (
    <span
      className="inline-flex items-center justify-center text-xs font-bold tabular-nums"
      style={{
        width: 28, height: 28,
        borderRadius: "50%",
        background: "var(--surface-2)",
        color: "var(--text-muted)",
      }}
    >
      {rank}
    </span>
  );
}

export default function LeaderboardClient({ miners, referrers, updatedAt }: Props) {
  const [tab, setTab] = useState<"miners" | "referrers">("miners");

  const tabs = [
    { id: "miners" as const, label: "Top Miners", icon: <IconPickaxe size={14} /> },
    { id: "referrers" as const, label: "Top Recruiters", icon: <IconUsers size={14} /> },
  ];

  return (
    <div className="w-full" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="mx-auto max-w-[640px] px-4 py-6 lg:px-6 lg:py-10">

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center mb-3"
            style={{ fontSize: 40 }}>
            <IconTrophy size={44} style={{ color: "var(--brand)" }} />
          </div>
          <span className="section-title block">Weekly Rankings</span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Leaderboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Top miners and recruiters of the week · names anonymised
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: "var(--surface-2)" }}
          role="tablist"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={
                tab === t.id
                  ? { background: "var(--bg)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.08)" }
                  : { color: "var(--text-muted)", background: "transparent" }
              }
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          {tab === "miners" ? (
            miners.length === 0 ? (
              <Empty label="No mining activity this week yet." />
            ) : (
              <ul>
                {miners.map((m) => (
                  <li
                    key={m.rank}
                    className="flex items-center gap-4 px-4 py-3.5"
                    style={{
                      borderBottom: m.rank < miners.length ? "1px solid var(--border)" : "none",
                      background: m.rank === 1 ? "color-mix(in oklab, var(--brand) 6%, transparent)" : undefined,
                    }}
                  >
                    <RankBadge rank={m.rank} />
                    <span className="flex-1 font-medium text-sm">{m.name}</span>
                    <span
                      className="font-mono text-sm font-semibold tabular-nums"
                      style={{ color: "var(--brand)" }}
                    >
                      ₱{m.amount.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            referrers.length === 0 ? (
              <Empty label="No referrals recorded yet." />
            ) : (
              <ul>
                {referrers.map((r) => (
                  <li
                    key={r.rank}
                    className="flex items-center gap-4 px-4 py-3.5"
                    style={{
                      borderBottom: r.rank < referrers.length ? "1px solid var(--border)" : "none",
                      background: r.rank === 1 ? "color-mix(in oklab, var(--brand) 6%, transparent)" : undefined,
                    }}
                  >
                    <RankBadge rank={r.rank} />
                    <span className="flex-1 font-medium text-sm">{r.name}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                      {r.count} {r.count === 1 ? "referral" : "referrals"}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>

        {updatedAt && (
          <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            Refreshes every page load · data as of{" "}
            {new Date(updatedAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-14 text-center text-sm" style={{ color: "var(--text-muted)" }}>
      {label}
    </div>
  );
}
