import crypto from "node:crypto";
import { prisma } from "./db.js";
import { getConfig } from "./config.js";

// Ad provider interface — the mock implementation lets the whole
// claim-gated-by-ads workflow run end-to-end without a real network.
// To swap in AdSense / Adsterra, replace `adProvider` with one that
// validates server-side SSV callbacks and signs tokens the same way.

export interface AdProvider {
  readonly name: string;
  /** Start an ad impression. In real providers this returns whatever
   *  the client SDK needs (slot id, secret, etc.). */
  startView(input: { userId: string }): Promise<{ providerPayload: Record<string, unknown> }>;
  /** Validate that an impression actually completed. Real providers
   *  verify a signed callback; the mock accepts any call after the
   *  minimum view duration has elapsed. */
  verifyView(input: {
    userId: string;
    providerToken: string;
    elapsedMs: number;
  }): Promise<{ ok: boolean; estimatedRevenue: number; reason?: string }>;
}

class MockAdProvider implements AdProvider {
  readonly name = "mock";

  async startView() {
    return {
      providerPayload: {
        provider: this.name,
        sdk: "mock-ad-v1",
        // Simulated CPM band: ₱10–₱30 per 1000 impressions
        estimatedCpm: 20,
      },
    };
  }

  async verifyView({ elapsedMs }: { elapsedMs: number }) {
    const cfg = await getConfig();
    if (elapsedMs < cfg.adViewDurationMs) {
      return { ok: false, estimatedRevenue: 0, reason: "ad_view_too_short" };
    }
    return { ok: true, estimatedRevenue: cfg.estimatedAdRevenuePerClaim };
  }
}

export const adProvider: AdProvider = new MockAdProvider();

function newToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function issueAdToken(params: {
  userId: string;
  placement?: string;
  ip?: string | null;
  deviceHash?: string | null;
}) {
  const cfg = await getConfig();
  const token = newToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + cfg.adTokenTtlMs);

  const providerStart = await adProvider.startView({ userId: params.userId });

  const rec = await prisma.adToken.create({
    data: {
      userId: params.userId,
      token,
      network: adProvider.name,
      placement: params.placement ?? "claim",
      expiresAt,
      ip: params.ip ?? null,
      deviceHash: params.deviceHash ?? null,
    },
  });

  return {
    id: rec.id,
    token,
    expiresAt,
    minViewDurationMs: cfg.adViewDurationMs,
    provider: providerStart.providerPayload,
  };
}

export async function markAdViewed(params: {
  userId: string;
  token: string;
  elapsedMs: number;
}) {
  const rec = await prisma.adToken.findUnique({ where: { token: params.token } });
  if (!rec || rec.userId !== params.userId) return { ok: false as const, reason: "not_found" };
  if (rec.consumedAt) return { ok: false as const, reason: "already_used" };
  if (rec.viewedAt) return { ok: false as const, reason: "already_viewed" };
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" };

  const verdict = await adProvider.verifyView({
    userId: params.userId,
    providerToken: rec.token,
    elapsedMs: params.elapsedMs,
  });

  if (!verdict.ok) return { ok: false as const, reason: verdict.reason ?? "invalid" };

  await prisma.$transaction([
    prisma.adToken.update({ where: { id: rec.id }, data: { viewedAt: new Date() } }),
    prisma.adImpression.create({
      data: {
        userId: params.userId,
        adTokenId: rec.id,
        network: rec.network,
        placement: rec.placement,
        estimatedRevenue: verdict.estimatedRevenue,
      },
    }),
  ]);

  return { ok: true as const, estimatedRevenue: verdict.estimatedRevenue };
}

type PrismaTxOrClient =
  | typeof prisma
  | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Consume a token — called inside the claim transaction. Returns the
 *  token record if it's valid, viewed, unexpired, and unused. */
export async function consumeAdToken(params: {
  userId: string;
  token: string;
  tx?: PrismaTxOrClient;
}) {
  const client: PrismaTxOrClient = params.tx ?? prisma;
  const rec = await client.adToken.findUnique({ where: { token: params.token } });
  if (!rec || rec.userId !== params.userId) return { ok: false as const, reason: "not_found" };
  if (rec.consumedAt) return { ok: false as const, reason: "already_used" };
  if (!rec.viewedAt) return { ok: false as const, reason: "not_viewed" };
  if (rec.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" };

  const updated = await client.adToken.update({
    where: { id: rec.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true as const, record: updated };
}
