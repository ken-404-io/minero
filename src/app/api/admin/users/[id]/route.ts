import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";

const schema = z.object({
  frozen: z.boolean().optional(),
  role: z.enum(["user", "admin"]).optional(),
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

  const user = await prisma.user.update({
    where: { id },
    data: result.data,
    select: { id: true, frozen: true, role: true },
  });

  // If frozen, cancel their pending withdrawals
  if (result.data.frozen === true) {
    await prisma.withdrawal.updateMany({
      where: { userId: id, status: "pending" },
      data: { status: "rejected", adminNote: "Account frozen" },
    });
  }

  return NextResponse.json({ user });
}
