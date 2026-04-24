import { prisma } from "./db.js";

// Bonus awarded per consecutive login day (index 0 = day 1, index 6 = day 7).
// After 7 days the streak display keeps incrementing but the bonus cycles.
const DAY_BONUSES = [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.10];

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function wasYesterday(date: Date, ref: Date): boolean {
  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);
  return sameCalendarDay(date, yesterday);
}

export type StreakResult = {
  streakCount: number;
  streakBonus: number;
  isNewDay: boolean;
};

/**
 * Call on every successful login. Awards a streak bonus if the user is logging
 * in for the first time today. Resets the streak if they skipped a day.
 * Returns { streakCount, streakBonus, isNewDay } — bonus is 0 when the user
 * already logged in today.
 */
export async function processStreak(userId: string): Promise<StreakResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakCount: true, lastStreakDate: true },
  });
  if (!user) return { streakCount: 0, streakBonus: 0, isNewDay: false };

  const now = new Date();
  const last = user.lastStreakDate;

  // Already logged in today — no-op.
  if (last && sameCalendarDay(last, now)) {
    return { streakCount: user.streakCount, streakBonus: 0, isNewDay: false };
  }

  // Consecutive day → increment; any other gap → reset to 1.
  const newStreak = last && wasYesterday(last, now) ? user.streakCount + 1 : 1;

  // Bonus cycles through the 7-day table (day 1-7, then repeats).
  const bonus = DAY_BONUSES[(newStreak - 1) % DAY_BONUSES.length];

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { streakCount: newStreak, lastStreakDate: now, balance: { increment: bonus } },
    }),
    prisma.earning.create({
      data: { userId, amount: bonus, type: "streak", status: "approved" },
    }),
  ]);

  return { streakCount: newStreak, streakBonus: bonus, isNewDay: true };
}
