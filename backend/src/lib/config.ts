import { prisma } from "./db.js";

// Hard-coded fallback defaults. Live values can override via the
// PlatformConfig table and be adjusted from /admin/rates without redeploy.

// Single plan tier — the paid "ad-free" upsell was retired. Both keys
// resolve to the same caps + neutral display name; existing rows in
// User.plan with value "paid" keep their pre-existing ad suppression
// (handled by AdBanner gating on plan), but no new upgrades are sold.
export const DEFAULT_PLANS = {
  free: { label: "Member", ratePerClaim: 0.02, dailyCap: 5.0, price: 0 },
  paid: { label: "Member", ratePerClaim: 0.02, dailyCap: 5.0, price: 0 },
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
  // Site-wide controls (admin-toggleable without redeploy)
  maintenanceMode: false,
  announcementBanner: "",
  registrationEnabled: true,
  claimsEnabled: true,
  withdrawalsEnabled: true,
};

const KEYS = {
  plans: "plans",
  claimIntervalMs: "claim_interval_ms",
  referralCommissionRate: "referral_commission_rate",
  referralApprovalWindowMs: "referral_approval_window_ms",
  maxReferralsPerDay: "max_referrals_per_day",
  withdrawalMinimum: "withdrawal_minimum",
  estimatedAdRevenuePerClaim: "est_ad_revenue_per_claim",
  maintenanceMode: "maintenance_mode",
  announcementBanner: "announcement_banner",
  registrationEnabled: "registration_enabled",
  claimsEnabled: "claims_enabled",
  withdrawalsEnabled: "withdrawals_enabled",
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

  // Normalize plan labels to the post-tier display ("Member"). Older
  // deployments may still have "Free (with ads)" / "Ad-Free" persisted
  // in PlatformConfig from before the upsell was retired.
  for (const k of Object.keys(parsed.plans) as PlanKey[]) {
    parsed.plans[k] = { ...parsed.plans[k], label: "Member" };
  }

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

  const bool = (k: string) => {
    const v = map.get(k);
    if (!v) return undefined;
    return v === "1" || v === "true";
  };

  const boolDefined = (k: string, def: boolean) => bool(k) ?? def;
  parsed.maintenanceMode    = boolDefined(KEYS.maintenanceMode,    parsed.maintenanceMode);
  parsed.registrationEnabled = boolDefined(KEYS.registrationEnabled, parsed.registrationEnabled);
  parsed.claimsEnabled      = boolDefined(KEYS.claimsEnabled,      parsed.claimsEnabled);
  parsed.withdrawalsEnabled = boolDefined(KEYS.withdrawalsEnabled, parsed.withdrawalsEnabled);

  const banner = map.get(KEYS.announcementBanner);
  if (banner !== undefined) parsed.announcementBanner = banner;

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
