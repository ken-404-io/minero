import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;

  const where = status === "all" ? {} : { status };

  const [withdrawals, total] = await prisma.$transaction([
    prisma.withdrawal.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.withdrawal.count({ where }),
  ]);

  return NextResponse.json({ withdrawals, total, page, pages: Math.ceil(total / limit) });
}
