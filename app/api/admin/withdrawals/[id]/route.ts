import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(200).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

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

  const { action, adminNote } = result.data;

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
  if (!withdrawal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (withdrawal.status !== "pending") {
    return NextResponse.json({ error: "Withdrawal already processed" }, { status: 409 });
  }

  if (action === "approve") {
    await prisma.withdrawal.update({
      where: { id },
      data: { status: "approved", processedAt: new Date(), adminNote },
    });
  } else {
    // Reject: refund the balance
    await prisma.$transaction([
      prisma.withdrawal.update({
        where: { id },
        data: { status: "rejected", processedAt: new Date(), adminNote },
      }),
      prisma.user.update({
        where: { id: withdrawal.userId },
        data: { balance: { increment: withdrawal.amount } },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
