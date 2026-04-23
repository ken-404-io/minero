import { prisma } from "./db.js";

// Hard-coded fallback defaults. Live values can override via the
// PlatformConfig table and be adjusted from /admin/rates without redeploy.

export const DEFAULT_PLANS = {
  free: { label: "Free (with ads)", ratePerClaim: 0.02, dailyCap: 5.0, price: 0  },
  paid: { label: "Ad-Free",         ratePerClaim: 0.02, dailyCap: 5.0, price: 49 },
} as const;

export type PlanKey = keyof typeof DEFAULT_PLANS;
export type PlanConfig = { label: string; ratePerClaim: number; dailyCap: number; price: number };
export type PlanConfigMap = Record<PlanKey, PlanConfig>;

export const AD_FREE_FEE_PHP = DEFAULT_PLANS.paid.price;

export const DEFAULTS = {
  plans: DEFAULT_PLANS as PlanConfigMap,
  claimIntervalMs: 10 * 60 * 1000,
  referralCommissionRate: 0.1,
  referralApprovalWindowMs: 24 * 60 * 60 * 1000,
  maxReferralsPerDay: 10,
  withdrawalMinimum: 300,
  adTokenTtlMs: 5 * 60 * 1000,
  adViewDurationMs: 5 * 1000,
  otpTtlMs: 10 * 60 * 1000,
  otpDigits: 6,
  estimatedAdRevenuePerClaim: 0.03, // mock provider CPM-based estimate
};

const KEYS = {
  plans: "plans",
  claimIntervalMs: "claim_interval_ms",
  referralCommissionRate: "referral_commission_rate",
  referralApprovalWindowMs: "referral_approval_window_ms",
  maxReferralsPerDay: "max_referrals_per_day",
  withdrawalMinimum: "withdrawal_minimum",
  estimatedAdRevenuePerClaim: "est_ad_revenue_per_claim",
} as const;

const CACHE_TTL_MS = 60_000;
let cache: { at: number; value: typeof DEFAULTS } | null = null;

async function loadAll(): Promise<typeof DEFAULTS> {
  const rows = await prisma.platformConfig.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const parsed: typeof DEFAULTS = { ...DEFAULTS };
  try {
    const plansRaw = map.get(KEYS.plans);
    if (plansRaw) parsed.plans = JSON.parse(plansRaw) as PlanConfigMap;
  } catch { /* fall back to defaults on malformed JSON */ }

  const num = (k: string) => {
    const v = map.get(k);
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  parsed.claimIntervalMs          = num(KEYS.claimIntervalMs)         ?? parsed.claimIntervalMs;
  parsed.referralCommissionRate   = num(KEYS.referralCommissionRate)  ?? parsed.referralCommissionRate;
  parsed.referralApprovalWindowMs = num(KEYS.referralApprovalWindowMs)?? parsed.referralApprovalWindowMs;
  parsed.maxReferralsPerDay       = num(KEYS.maxReferralsPerDay)      ?? parsed.maxReferralsPerDay;
  parsed.withdrawalMinimum        = num(KEYS.withdrawalMinimum)       ?? parsed.withdrawalMinimum;
  parsed.estimatedAdRevenuePerClaim = num(KEYS.estimatedAdRevenuePerClaim) ?? parsed.estimatedAdRevenuePerClaim;

  return parsed;
}

export async function getConfig(): Promise<typeof DEFAULTS> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const value = await loadAll();
    cache = { at: Date.now(), value };
    return value;
  } catch {
    // DB unavailable — fall back to hard-coded defaults so the app stays up
    return DEFAULTS;
  }
}

export function invalidateConfigCache() {
  cache = null;
}

export async function getPlanConfig(plan: string): Promise<PlanConfig> {
  const cfg = await getConfig();
  return cfg.plans[plan as PlanKey] ?? cfg.plans.free;
}

export function isActivated(plan: string): boolean {
  return plan === "paid";
}

// Admin updaters — invalidate cache on write so changes are live.
export async function setConfigValue(
  key: keyof typeof KEYS,
  value: unknown,
  updatedBy?: string,
) {
  const stored = typeof value === "string" ? value : JSON.stringify(value);
  await prisma.platformConfig.upsert({
    where: { key: KEYS[key] },
    create: { key: KEYS[key], value: stored, updatedBy: updatedBy ?? null },
    update: { value: stored, updatedBy: updatedBy ?? null },
  });
  invalidateConfigCache();
}
