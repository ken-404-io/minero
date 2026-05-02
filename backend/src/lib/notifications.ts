import { prisma } from "./db.js";
import { getConfig } from "./config.js";

export type NotificationType =
  | "mining_ready"
  | "withdrawal_submitted"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "referral_credited"
  | "admin";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  createdBy?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
}

export type BroadcastInput = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  createdBy?: string | null;
  /** Limit broadcast to a specific subset of users. Omit to send to everyone (non-frozen). */
  userIds?: string[];
};

/** Fan out a single notification to many users. Returns the number created. */
export async function broadcastNotification(input: BroadcastInput): Promise<number> {
  let recipients: { id: string }[];
  if (input.userIds && input.userIds.length > 0) {
    recipients = await prisma.user.findMany({
      where: { id: { in: input.userIds } },
      select: { id: true },
    });
  } else {
    recipients = await prisma.user.findMany({
      where: { frozen: false },
      select: { id: true },
    });
  }

  if (recipients.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: recipients.map((u) => ({
      userId: u.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      createdBy: input.createdBy ?? null,
    })),
  });

  return result.count;
}

/**
 * If the user's claim cooldown has elapsed and they don't yet have an
 * unread "mining_ready" notification for the current cycle, create one.
 * Idempotent — safe to call on every bell poll. Returns true if a new
 * notification was created.
 *
 * "Current cycle" = "since the most recent claim". A new claim resets
 * the cycle, so the next time cooldown elapses we create another notif.
 */
export async function ensureMiningReadyNotification(userId: string): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg.claimsEnabled) return false;

  const lastClaim = await prisma.claim.findFirst({
    where: { userId },
    orderBy: { claimedAt: "desc" },
    select: { claimedAt: true },
  });

  // No claim history yet → user has never mined; don't spam them with a
  // "ready" notification before they even know what mining is.
  if (!lastClaim) return false;

  const readyAt = new Date(lastClaim.claimedAt.getTime() + cfg.claimIntervalMs);
  if (readyAt.getTime() > Date.now()) return false;

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: "mining_ready",
      createdAt: { gte: lastClaim.claimedAt },
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.notification.create({
    data: {
      userId,
      type: "mining_ready",
      title: "Mining is ready!",
      body: "Your next reward is available to claim. Tap to mine.",
      link: "/dashboard",
    },
  });
  return true;
}
