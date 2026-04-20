import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/backend/lib/auth";
import { prisma } from "@/backend/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;

  const [earnings, total] = await prisma.$transaction([
    prisma.earning.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.earning.count({ where: { userId: session.userId } }),
  ]);

  return NextResponse.json({ earnings, total, page, pages: Math.ceil(total / limit) });
}
