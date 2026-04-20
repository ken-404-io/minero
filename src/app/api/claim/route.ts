import { NextRequest, NextResponse } from "next/server";
import type { PrismaClient } from "@/backend/generated/prisma/client";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";
import {
  getPlanConfig,
  CLAIM_INTERVAL_MS,
  REFERRAL_COMMISSION_RATE,
} from "@/backend/lib/mining";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.frozen) return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  const plan = getPlanConfig(user.plan);
  const now = new Date();

  // Check last claim
  const lastClaim = await prisma.claim.findFirst({
    where: { userId: user.id },
    orderBy: { claimedAt: "desc" },
  });

  if (lastClaim) {
    const elapsed = now.getTime() - lastClaim.claimedAt.getTime();
    if (elapsed < CLAIM_INTERVAL_MS) {
      const remainingMs = CLAIM_INTERVAL_MS - elapsed;
      return NextResponse.json(
        { error: "Too soon", remainingMs },
        { status: 429 }
      );
    }
  }

  // Check daily cap
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const todayEarnings = await prisma.earning.aggregate({
    where: {
      userId: user.id,
      type: "mining",
      createdAt: { gte: startOfDay },
      status: { not: "rejected" },
    },
    _sum: { amount: true },
  });

  const todayTotal = todayEarnings._sum.amount ?? 0;
  if (todayTotal >= plan.dailyCap) {
    return NextResponse.json({ error: "Daily cap reached" }, { status: 403 });
  }

  const amount = Math.min(plan.ratePerClaim, plan.dailyCap - todayTotal);

  // Get IP and a simple device hint from headers
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  // Fraud check: same IP as another user who claimed in last hour
  // (silently block but still respond so client doesn't retry aggressively)
  const recentSameIp = await prisma.claim.findFirst({
    where: {
      ip,
      userId: { not: user.id },
      claimedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });

  if (recentSameIp) {
    // Flag but don't reward
    return NextResponse.json({ error: "Claim blocked" }, { status: 403 });
  }

  // Create claim and earning in a transaction
  const result = await prisma.$transaction(async (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
    const claim = await tx.claim.create({
      data: { userId: user.id, amount, ip, adToken: null },
    });

    const earning = await tx.earning.create({
      data: { userId: user.id, amount, type: "mining", status: "approved" },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { balance: { increment: amount } },
    });

    // Referral commission
    if (user.referredBy) {
      const referrer = await tx.user.findUnique({ where: { id: user.referredBy } });
      if (referrer && !referrer.frozen) {
        const commission = parseFloat((amount * REFERRAL_COMMISSION_RATE).toFixed(4));
        await tx.earning.create({
          data: {
            userId: user.referredBy,
            amount: commission,
            type: "referral",
            status: "pending",
          },
        });
        await tx.user.update({
          where: { id: user.referredBy },
          data: { pendingBalance: { increment: commission } },
        });
        await tx.referral.updateMany({
          where: { referrerId: user.referredBy, referralId: user.id },
          data: { commissionTotal: { increment: commission } },
        });
      }
    }

    return { claim, earning };
  });

  return NextResponse.json({
    amount: result.earning.amount,
    newBalance: user.balance + amount,
    claimedAt: result.claim.claimedAt,
    nextClaimAt: new Date(result.claim.claimedAt.getTime() + CLAIM_INTERVAL_MS),
  });
}
