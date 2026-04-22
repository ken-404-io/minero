// Compatibility shim. Runtime code should import from ./config.js so it
// picks up live-tunable values set via the admin panel.
//
// These constants remain as fallback defaults and for any caller that
// needs a synchronous value (e.g. seed scripts).

import { DEFAULTS, DEFAULT_PLANS, isActivated as _isActivated, type PlanKey as _PlanKey } from "./config.js";

export const PLANS = DEFAULT_PLANS;
export type PlanKey = _PlanKey;

export const CLAIM_INTERVAL_MS = DEFAULTS.claimIntervalMs;
export const REFERRAL_COMMISSION_RATE = DEFAULTS.referralCommissionRate;
export const REFERRAL_APPROVAL_WINDOW_MS = DEFAULTS.referralApprovalWindowMs;
export const MAX_REFERRALS_PER_DAY = DEFAULTS.maxReferralsPerDay;
export const WITHDRAWAL_MINIMUM = DEFAULTS.withdrawalMinimum;

export function getPlanConfig(plan: string) {
  return DEFAULT_PLANS[plan as PlanKey] ?? DEFAULT_PLANS.free;
}

export const isActivated = _isActivated;
