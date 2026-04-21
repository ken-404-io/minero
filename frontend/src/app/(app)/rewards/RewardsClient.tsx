"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  IconCheck,
  IconCoins,
  IconGift,
  IconLock,
  IconSparkles,
  IconTrophy,
  IconX,
} from "@/components/icons";

/* ============================================================
   Conversion config
   ------------------------------------------------------------
   Flat rate: 2,499 game points = ₱1.
   Each "card" is a fixed-peso denomination the user redeems.
   ============================================================ */

const POINTS_PER_PESO = 2499;

type RewardCard = {
  id: string;
  label: string;
  peso: number;
  accent: "brand" | "success" | "gold";
};

const CARDS: RewardCard[] = [
  { id: "card-1",   label: "Starter",  peso: 1,   accent: "brand" },
  { id: "card-5",   label: "Bronze",   peso: 5,   accent: "brand" },
  { id: "card-10",  label: "Silver",   peso: 10,  accent: "success" },
  { id: "card-20",  label: "Gold",     peso: 20,  accent: "gold" },
  { id: "card-50",  label: "Platinum", peso: 50,  accent: "gold" },
  { id: "card-100", label: "Diamond",  peso: 100, accent: "gold" },
];

function cardCost(peso: number) {
  return peso * POINTS_PER_PESO;
}

/* ============================================================
   Game-points aggregation
   ------------------------------------------------------------
   Each game writes its own localStorage stats object with a
   numeric `totalPoints` field. We sum them into an "earned"
   total, then subtract redeemed points for availability.
   ============================================================ */

const GAME_KEYS = [
  "minero_trivia_stats_v1",
  "minero_spin_stats_v1",
  "minero_memory_stats_v1",
  "minero_minesweeper_stats_v1",
  "minero_word_stats_v1",
  "minero_snake_stats_v1",
];

function readTotalFromKey(key: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { totalPoints?: unknown };
    const n = Number(parsed?.totalPoints);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function readEarnedTotal(): number {
  return GAME_KEYS.reduce((sum, k) => sum + readTotalFromKey(k), 0);
}

/* ============================================================
   Redemption state (localStorage)
   ============================================================ */

type Redemption = {
  id: string;       // unique per redeem
  cardId: string;   // reward-card id
  peso: number;     // peso value credited
  pointsSpent: number;
  at: number;       // epoch ms
};

type RewardsState = {
  redeemedPoints: number;
  redemptions: Redemption[];
};

const REWARDS_KEY = "minero_rewards_v1";
const EMPTY_STATE: RewardsState = { redeemedPoints: 0, redemptions: [] };

function parseRewards(raw: string | null): RewardsState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<RewardsState>;
    const redemptions = Array.isArray(parsed.redemptions)
      ? parsed.redemptions
          .map((r) => {
            const red = r as Partial<Redemption>;
            return {
              id: String(red.id ?? ""),
              cardId: String(red.cardId ?? ""),
              peso: Number(red.peso) || 0,
              pointsSpent: Number(red.pointsSpent) || 0,
              at: Number(red.at) || 0,
            };
          })
          .filter((r) => r.id && r.cardId && r.peso > 0)
      : [];
    const redeemed = Number(parsed.redeemedPoints);
    return {
      redeemedPoints: Number.isFinite(redeemed) && redeemed > 0 ? redeemed : 0,
      redemptions,
    };
  } catch {
    return EMPTY_STATE;
  }
}

let rewardsRaw: string | null = null;
let rewardsCache: RewardsState = EMPTY_STATE;

function getRewardsSnapshot(): RewardsState {
  if (typeof window === "undefined") return EMPTY_STATE;
  const raw = window.localStorage.getItem(REWARDS_KEY);
  if (raw !== rewardsRaw) {
    rewardsRaw = raw;
    rewardsCache = parseRewards(raw);
  }
  return rewardsCache;
}

function subscribeRewards(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === REWARDS_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("minero:rewards-change", cb as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("minero:rewards-change", cb as EventListener);
  };
}

const getRewardsServer = () => EMPTY_STATE;

function writeRewards(next: RewardsState) {
  window.localStorage.setItem(REWARDS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("minero:rewards-change"));
}

/* ============================================================
   Earned-total subscription (sums across the 6 game keys)
   ============================================================ */

function subscribeEarned(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key && GAME_KEYS.includes(e.key)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function getEarnedSnapshot(): number {
  return readEarnedTotal();
}

const getEarnedServer = () => 0;

/* ============================================================
   Formatters
   ============================================================ */

function formatInt(n: number) {
  return n.toLocaleString();
}

function formatPeso(n: number) {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(ms: number) {
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/* ============================================================
   Page
   ============================================================ */

export default function RewardsClient({ playerName }: { playerName: string }) {
  const earned = useSyncExternalStore(subscribeEarned, getEarnedSnapshot, getEarnedServer);
  const rewards = useSyncExternalStore(subscribeRewards, getRewardsSnapshot, getRewardsServer);

  const [confirmCard, setConfirmCard] = useState<RewardCard | null>(null);
  const [lastRedeemed, setLastRedeemed] = useState<Redemption | null>(null);

  // Heal state if earned drops below redeemed (e.g. user cleared game data).
  useEffect(() => {
    if (rewards.redeemedPoints > earned) {
      writeRewards({ ...rewards, redeemedPoints: earned });
    }
  }, [earned, rewards]);

  const available = Math.max(0, earned - rewards.redeemedPoints);
  const totalCashedOut = rewards.redemptions.reduce((sum, r) => sum + r.peso, 0);
  const firstName = playerName?.split(/\s+/)[0] || "Miner";

  const redeem = useCallback(
    (card: RewardCard) => {
      const cost = cardCost(card.peso);
      if (available < cost) return;
      const entry: Redemption = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        cardId: card.id,
        peso: card.peso,
        pointsSpent: cost,
        at: Date.now(),
      };
      writeRewards({
        redeemedPoints: rewards.redeemedPoints + cost,
        redemptions: [entry, ...rewards.redemptions].slice(0, 50),
      });
      setConfirmCard(null);
      setLastRedeemed(entry);
    },
    [available, rewards],
  );

  // Lock body scroll while confirm sheet open
  useEffect(() => {
    if (confirmCard) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [confirmCard]);

  // Auto-clear success toast after 5s
  useEffect(() => {
    if (!lastRedeemed) return;
    const id = setTimeout(() => setLastRedeemed(null), 5000);
    return () => clearTimeout(id);
  }, [lastRedeemed]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 lg:mb-8">
        <span className="section-title">Redeem</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">Rewards</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Hi {firstName} — turn your game points into peso-value cards. Flat rate:{" "}
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            {formatInt(POINTS_PER_PESO)} points = ₱1
          </span>
          .
        </p>
      </header>

      {lastRedeemed && (
        <div className="alert alert-success mb-4" role="status">
          <IconCheck size={16} />
          <span>
            Redeemed a {formatPeso(lastRedeemed.peso)} card for{" "}
            {formatInt(lastRedeemed.pointsSpent)} points.
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="kpi">
          <span className="kpi-label">Points available</span>
          <span className="kpi-value kpi-value-brand">{formatInt(available)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Points earned (lifetime)</span>
          <span className="kpi-value">{formatInt(earned)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Peso value available</span>
          <span className="kpi-value">{formatPeso(Math.floor(available / POINTS_PER_PESO))}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Redeemed so far</span>
          <span className="kpi-value">{formatPeso(totalCashedOut)}</span>
        </div>
      </div>

      {/* Reward cards */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">Reward cards</span>
          <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
            {formatInt(POINTS_PER_PESO)} pts per ₱1 · fixed rate
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {CARDS.map((card) => {
            const cost = cardCost(card.peso);
            const canRedeem = available >= cost;
            return (
              <RewardCardView
                key={card.id}
                card={card}
                cost={cost}
                available={available}
                canRedeem={canRedeem}
                onSelect={() => setConfirmCard(card)}
              />
            );
          })}
        </div>
      </section>

      {/* History */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <span className="section-title">Redemption history</span>
          {rewards.redemptions.length > 0 && (
            <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
              {rewards.redemptions.length} total
            </span>
          )}
        </div>

        {rewards.redemptions.length === 0 ? (
          <div
            className="card flex items-center gap-3"
            style={{ color: "var(--text-muted)" }}
          >
            <IconTrophy size={18} />
            <span className="text-sm">
              No redemptions yet. Play games to earn points, then claim a card above.
            </span>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rewards.redemptions.map((r) => {
              const card = CARDS.find((c) => c.id === r.cardId);
              return (
                <li
                  key={r.id}
                  className="card flex items-center gap-3"
                  style={{ padding: "12px 14px" }}
                >
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
                  >
                    <IconGift size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">
                      {card?.label ?? "Card"} · {formatPeso(r.peso)}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                      {formatInt(r.pointsSpent)} pts · {formatDate(r.at)}
                    </div>
                  </div>
                  <span className="badge badge-approved">
                    <IconCheck size={12} /> Redeemed
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Footer note */}
      <div
        className="mt-8 flex items-start gap-2 text-xs"
        style={{ color: "var(--text-subtle)" }}
      >
        <IconCoins size={14} />
        <span>
          Reward cards are tracked locally on this device. Points come from the Game
          hub and can only be spent once.
        </span>
      </div>

      {/* Confirm sheet */}
      {confirmCard && (
        <>
          <div
            className="sheet-scrim"
            onClick={() => setConfirmCard(null)}
            aria-hidden
          />
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-sheet-title"
          >
            <div className="sheet-handle" aria-hidden />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="section-title">Redeem</span>
                <h2 id="reward-sheet-title" className="text-xl font-semibold mt-1">
                  {confirmCard.label} card
                </h2>
              </div>
              <button
                onClick={() => setConfirmCard(null)}
                className="btn-icon"
                aria-label="Close"
              >
                <IconX size={18} />
              </button>
            </div>

            <div className="surface-2 p-4 mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Peso value
                </span>
                <span className="text-2xl font-bold" style={{ color: "var(--brand)" }}>
                  {formatPeso(confirmCard.peso)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Points required
                </span>
                <span className="font-mono text-sm">
                  {formatInt(cardCost(confirmCard.peso))}
                </span>
              </div>
            </div>

            <div className="flex items-baseline justify-between text-sm mb-4">
              <span style={{ color: "var(--text-muted)" }}>You have</span>
              <span className="font-mono">{formatInt(available)} pts</span>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setConfirmCard(null)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => redeem(confirmCard)}
                disabled={available < cardCost(confirmCard.peso)}
                className="btn btn-primary flex-1"
              >
                <IconSparkles size={16} /> Confirm redeem
              </button>
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
              Once redeemed, the points are deducted and the card appears in your
              history below.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Reward card tile
   ============================================================ */

function RewardCardView({
  card,
  cost,
  available,
  canRedeem,
  onSelect,
}: {
  card: RewardCard;
  cost: number;
  available: number;
  canRedeem: boolean;
  onSelect: () => void;
}) {
  const pct = Math.min(100, Math.round((available / cost) * 100));
  const accentBg =
    card.accent === "gold"
      ? "linear-gradient(165deg, color-mix(in oklab, #f5c45e 35%, transparent), var(--surface))"
      : card.accent === "success"
      ? "linear-gradient(165deg, color-mix(in oklab, var(--success-fg) 22%, transparent), var(--surface))"
      : "linear-gradient(165deg, color-mix(in oklab, var(--brand-weak) 55%, transparent), var(--surface))";
  const accentFg =
    card.accent === "gold"
      ? "#b8860b"
      : card.accent === "success"
      ? "var(--success-fg)"
      : "var(--brand)";

  return (
    <div
      className="card flex flex-col gap-3"
      style={{ background: accentBg }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-2)", color: accentFg }}
        >
          <IconGift size={22} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-semibold leading-snug">
            {card.label}
          </h2>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
            Redeem card
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold tabular-nums" style={{ color: accentFg }}>
            ₱{card.peso}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-subtle)" }}>
            peso value
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span style={{ color: "var(--text-muted)" }}>Cost</span>
        <span className="font-mono" style={{ color: "var(--text)" }}>
          {formatInt(cost)} pts
        </span>
      </div>

      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: "var(--surface-2)" }}
        aria-hidden
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: canRedeem ? accentFg : "var(--text-subtle)",
            transition: "width 240ms ease",
          }}
        />
      </div>

      <button
        onClick={onSelect}
        disabled={!canRedeem}
        className={canRedeem ? "btn btn-primary" : "btn btn-ghost"}
      >
        {canRedeem ? (
          <>
            <IconGift size={16} /> Redeem now
          </>
        ) : (
          <>
            <IconLock size={16} /> {pct}% to unlock
          </>
        )}
      </button>
    </div>
  );
}
