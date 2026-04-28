import { prisma } from "./db.js";
import { raiseAlert } from "./fraud.js";

/**
 * Device-uniqueness enforcement.
 *
 * Goal: prevent one physical device from creating multiple Minero accounts —
 * the most common shape of farming/abuse on a free-money platform.
 *
 * Signal: client-side fingerprint (`X-Device-Hash` header) computed by
 * `frontend/src/lib/device.ts`. Persisted on User as `signupDevice` (the
 * device the account was created on) and `lastDeviceHash` (the most
 * recent device the account logged in from).
 *
 * Match logic: a device is "in use" if any non-frozen account has it as
 * either signupDevice OR lastDeviceHash. Frozen accounts don't gate new
 * signups (we want fraudsters to lose access, not the device).
 *
 * Out of scope: shared family devices, public computers, browser refresh
 * that wipes localStorage. The fingerprint is a soft signal; legitimate
 * users hit by a false positive can contact support.
 */

export type DeviceCheckResult =
  | { ok: true }
  | { ok: false; reason: "device_in_use"; existingUserId: string };

export async function checkDeviceAvailableForSignup(
  deviceHash: string,
): Promise<DeviceCheckResult> {
  const existing = await prisma.user.findFirst({
    where: {
      frozen: false,
      OR: [{ signupDevice: deviceHash }, { lastDeviceHash: deviceHash }],
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, reason: "device_in_use", existingUserId: existing.id };
  }
  return { ok: true };
}

/** Returns the number of distinct, non-frozen accounts associated with this device. */
export async function countAccountsOnDevice(deviceHash: string): Promise<number> {
  const rows = await prisma.user.findMany({
    where: {
      frozen: false,
      OR: [{ signupDevice: deviceHash }, { lastDeviceHash: deviceHash }],
    },
    select: { id: true },
  });
  return rows.length;
}

/** Raise a multi_account_signup fraud alert for a device-uniqueness violation. */
export async function raiseDeviceFraudAlert(args: {
  attemptedEmail?: string;
  attemptedUserId?: string | null;
  existingUserId: string;
  ip: string;
  deviceHash: string;
  via: "register" | "oauth" | "login";
}) {
  await raiseAlert({
    userId: args.existingUserId,
    type: "multi_account_signup",
    severity: "high",
    details: {
      attemptedEmail: args.attemptedEmail,
      attemptedUserId: args.attemptedUserId,
      ip: args.ip,
      deviceHash: args.deviceHash,
      via: args.via,
    },
  });
}
