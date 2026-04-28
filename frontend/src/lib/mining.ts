// Display-side mirror of backend/src/lib/config.ts. Keep in sync when plan
// rates, intervals, or caps change.

// Single plan tier — the paid "ad-free" upsell was retired. Existing
// users with plan="paid" still exist in the DB and are mapped to the
// same display as everyone else; only the legacy ad-suppression behavior
// for those accounts remains.
export const PLANS = {
  free: { label: "Member", ratePerClaim: 0.02, dailyCap: 5.0, price: 0 },
  paid: { label: "Member", ratePerClaim: 0.02, dailyCap: 5.0, price: 0 },
} as const;

export type PlanKey = keyof typeof PLANS;

export const AD_FREE_FEE_PHP = PLANS.paid.price;
export const CLAIM_INTERVAL_MS = 10 * 60 * 1000;
export const REFERRAL_COMMISSION_RATE = 0.1;
export const WITHDRAWAL_MINIMUM = 300;

export function getPlanConfig(plan: string) {
  return PLANS[plan as PlanKey] ?? PLANS.free;
}

export function isAdFree(plan: string): boolean {
  return plan === "paid";
}
