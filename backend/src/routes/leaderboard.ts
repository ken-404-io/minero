import { Hono } from "hono";
import { prisma } from "../lib/db.js";

export const leaderboardRoutes = new Hono();

function anonymize(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? "U") + "•••";
  return `${parts[0]} ${(parts[1]?.[0] ?? "").toUpperCase()}.`;
}

leaderboardRoutes.get("/", async (c) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [topMinerRows, topReferrerRows] = await Promise.all([
    prisma.earning.groupBy({
      by: ["userId"],
      where: { type: "mining", status: "approved", createdAt: { gte: weekAgo } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    prisma.referral.groupBy({
      by: ["referrerId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  const minerIds = topMinerRows.map((r) => r.userId);
  const referrerIds = topReferrerRows.map((r) => r.referrerId);
  const allIds = [...new Set([...minerIds, ...referrerIds])];

  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  return c.json({
    updatedAt: new Date().toISOString(),
    miners: topMinerRows.map((row, i) => ({
      rank: i + 1,
      name: anonymize(nameMap.get(row.userId) ?? "User"),
      amount: parseFloat((row._sum.amount ?? 0).toFixed(4)),
    })),
    referrers: topReferrerRows.map((row, i) => ({
      rank: i + 1,
      name: anonymize(nameMap.get(row.referrerId) ?? "User"),
      count: row._count.id,
    })),
  });
});
