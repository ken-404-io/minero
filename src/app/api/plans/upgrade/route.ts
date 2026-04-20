import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";
import { PLANS, canUpgradeTo } from "@/backend/lib/mining";

const schema = z.object({
  plan: z.enum(["plan499", "plan699", "plan799"]),
  paymentRef: z.string().min(5).max(100),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.frozen) return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten().fieldErrors }, { status: 400 });
  }

  const { plan, paymentRef } = result.data;

  if (!canUpgradeTo(user.plan, plan)) {
    return NextResponse.json({ error: "Cannot downgrade or re-purchase current plan" }, { status: 400 });
  }

  const planConfig = PLANS[plan];

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { plan } }),
    prisma.planLog.create({
      data: { userId: user.id, plan, amountPaid: planConfig.price, paymentRef },
    }),
  ]);

  return NextResponse.json({ ok: true, plan, label: planConfig.label });
}
