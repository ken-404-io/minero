import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WITHDRAWAL_MINIMUM } from "@/lib/mining";

const schema = z.object({
  amount: z.number().min(WITHDRAWAL_MINIMUM),
  method: z.enum(["gcash", "maya"]),
  accountNumber: z.string().min(10).max(20).regex(/^\d+$/),
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

  const { amount, method, accountNumber } = result.data;

  if (user.balance < amount) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  // Check no pending withdrawal already
  const pending = await prisma.withdrawal.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (pending) {
    return NextResponse.json({ error: "You already have a pending withdrawal" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.withdrawal.create({
      data: { userId: user.id, amount, method, accountNumber },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { balance: { decrement: amount } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.userId },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json({ withdrawals });
}
