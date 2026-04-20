import { NextResponse } from "next/server";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";
import { REFERRAL_APPROVAL_WINDOW_MS } from "@/backend/lib/mining";

// Called by a cron job or admin trigger to approve matured referral commissions
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - REFERRAL_APPROVAL_WINDOW_MS);

  const pendingCommissions = await prisma.earning.findMany({
    where: { type: "referral", status: "pending", createdAt: { lte: cutoff } },
  });

  if (pendingCommissions.length === 0) {
    return NextResponse.json({ approved: 0 });
  }

  await Promise.all(
    pendingCommissions.map((e) =>
      prisma.$transaction([
        prisma.earning.update({ where: { id: e.id }, data: { status: "approved" } }),
        prisma.user.update({
          where: { id: e.userId },
          data: {
            balance: { increment: e.amount },
            pendingBalance: { decrement: e.amount },
          },
        }),
      ])
    )
  );

  return NextResponse.json({ approved: pendingCommissions.length });
}
