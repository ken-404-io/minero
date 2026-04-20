import { prisma } from "./db.js";

export type FraudAlertInput = {
  userId?: string | null;
  type:
    | "duplicate_ip"
    | "duplicate_device"
    | "rapid_claim"
    | "frozen_claim_attempt"
    | "invalid_ad_token"
    | "referral_cap_hit"
    | "multi_account_signup";
  severity?: "low" | "medium" | "high";
  details?: Record<string, unknown>;
};

export async function raiseAlert(input: FraudAlertInput) {
  await prisma.fraudAlert.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      severity: input.severity ?? "medium",
      details: JSON.stringify(input.details ?? {}),
    },
  });
}
