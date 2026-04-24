import { prisma } from "./db.js";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
};

export async function getUserAchievements(userId: string): Promise<Achievement[]> {
  const [claimCount, miningAgg, referralCount, user] = await Promise.all([
    prisma.claim.count({ where: { userId } }),
    prisma.earning.aggregate({
      where: { userId, type: "mining", status: "approved" },
      _sum: { amount: true },
    }),
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakCount: true, createdAt: true },
    }),
  ]);

  const totalMined = miningAgg._sum.amount ?? 0;
  const streak = user?.streakCount ?? 0;
  const accountAgeDays = user
    ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000)
    : 0;

  return [
    {
      id: "first_claim",
      emoji: "⛏️",
      title: "First Dig",
      description: "Make your first mining claim",
      unlocked: claimCount >= 1,
      progress: { current: Math.min(claimCount, 1), target: 1 },
    },
    {
      id: "claim_10",
      emoji: "🪨",
      title: "Regular Miner",
      description: "Make 10 mining claims",
      unlocked: claimCount >= 10,
      progress: { current: Math.min(claimCount, 10), target: 10 },
    },
    {
      id: "claim_50",
      emoji: "💎",
      title: "Veteran Miner",
      description: "Make 50 mining claims",
      unlocked: claimCount >= 50,
      progress: { current: Math.min(claimCount, 50), target: 50 },
    },
    {
      id: "claim_100",
      emoji: "🏆",
      title: "Mining Legend",
      description: "Make 100 mining claims",
      unlocked: claimCount >= 100,
      progress: { current: Math.min(claimCount, 100), target: 100 },
    },
    {
      id: "earn_1",
      emoji: "💰",
      title: "First Peso",
      description: "Earn ₱1 from mining",
      unlocked: totalMined >= 1,
      progress: { current: Math.min(Math.floor(totalMined * 100) / 100, 1), target: 1 },
    },
    {
      id: "earn_10",
      emoji: "💵",
      title: "Big Earner",
      description: "Earn ₱10 from mining",
      unlocked: totalMined >= 10,
      progress: { current: Math.min(Math.floor(totalMined * 100) / 100, 10), target: 10 },
    },
    {
      id: "earn_50",
      emoji: "🤑",
      title: "High Roller",
      description: "Earn ₱50 from mining",
      unlocked: totalMined >= 50,
      progress: { current: Math.min(Math.floor(totalMined * 100) / 100, 50), target: 50 },
    },
    {
      id: "first_referral",
      emoji: "🤝",
      title: "Social Miner",
      description: "Refer your first friend",
      unlocked: referralCount >= 1,
      progress: { current: Math.min(referralCount, 1), target: 1 },
    },
    {
      id: "referral_5",
      emoji: "🌐",
      title: "Networker",
      description: "Refer 5 friends",
      unlocked: referralCount >= 5,
      progress: { current: Math.min(referralCount, 5), target: 5 },
    },
    {
      id: "referral_10",
      emoji: "👑",
      title: "Top Recruiter",
      description: "Refer 10 friends",
      unlocked: referralCount >= 10,
      progress: { current: Math.min(referralCount, 10), target: 10 },
    },
    {
      id: "streak_3",
      emoji: "🔥",
      title: "On a Roll",
      description: "Log in 3 days in a row",
      unlocked: streak >= 3,
      progress: { current: Math.min(streak, 3), target: 3 },
    },
    {
      id: "streak_7",
      emoji: "⚡",
      title: "Streak Week",
      description: "Log in 7 days in a row",
      unlocked: streak >= 7,
      progress: { current: Math.min(streak, 7), target: 7 },
    },
    {
      id: "streak_30",
      emoji: "🌟",
      title: "Dedicated Miner",
      description: "Log in 30 days in a row",
      unlocked: streak >= 30,
      progress: { current: Math.min(streak, 30), target: 30 },
    },
    {
      id: "veteran",
      emoji: "🎖️",
      title: "Veteran",
      description: "Account is 30+ days old",
      unlocked: accountAgeDays >= 30,
      progress: { current: Math.min(accountAgeDays, 30), target: 30 },
    },
  ];
}
