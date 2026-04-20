// Display-side mirror of backend/src/lib/mining.ts. Keep in sync when plan
// rates, intervals, or caps change.

export const PLANS = {
  free: { label: "Free", ratePerClaim: 0.005, dailyCap: 3.0, price: 0 },
  plan499: { label: "₱499 Plan", ratePerClaim: 0.02, dailyCap: 4.0, price: 499 },
  plan699: { label: "₱699 Plan", ratePerClaim: 0.035, dailyCap: 6.0, price: 699 },
  plan799: { label: "₱799 Plan", ratePerClaim: 0.045, dailyCap: 8.0, price: 799 },
} as const;

export type PlanKey = keyof typeof PLANS;

export const CLAIM_INTERVAL_MS = 10 * 60 * 1000;
export const REFERRAL_COMMISSION_RATE = 0.1;
export const WITHDRAWAL_MINIMUM = 300;

export function getPlanConfig(plan: string) {
  return PLANS[plan as PlanKey] ?? PLANS.free;
}
