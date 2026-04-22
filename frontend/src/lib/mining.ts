// Display-side mirror of backend/src/lib/config.ts. Keep in sync when plan
// rates, intervals, or caps change.

export const PLANS = {
  free: { label: "Free",      ratePerClaim: 0,    dailyCap: 0,   price: 0  },
  paid: { label: "Activated", ratePerClaim: 0.02, dailyCap: 5.0, price: 49 },
} as const;

export type PlanKey = keyof typeof PLANS;

export const ACTIVATION_FEE_PHP = PLANS.paid.price;
export const CLAIM_INTERVAL_MS = 10 * 60 * 1000;
export const REFERRAL_COMMISSION_RATE = 0.1;
export const WITHDRAWAL_MINIMUM = 300;

export function getPlanConfig(plan: string) {
  return PLANS[plan as PlanKey] ?? PLANS.free;
}

export function isActivated(plan: string): boolean {
  return plan === "paid";
}
