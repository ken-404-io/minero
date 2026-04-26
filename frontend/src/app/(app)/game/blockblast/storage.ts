export type Stats = {
  totalCoins: number;
  bestScore: number;
  gamesPlayed: number;
  linesCleared: number;
};

export type DailyData = { date: string; plays: number };

export const EMPTY_STATS: Stats = {
  totalCoins: 0,
  bestScore: 0,
  gamesPlayed: 0,
  linesCleared: 0,
};

export const STORAGE_KEY = "minero_blockblast_stats_v1";
export const DAILY_KEY = "minero_blockblast_daily_v1";
export const MAX_DAILY_PLAYS = 20;

export function loadStats(): Stats {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as
      | (Partial<Stats> & { totalPoints?: number })
      | null;
    if (!p) return EMPTY_STATS;
    return {
      totalCoins: Number(p.totalCoins) || Number(p.totalPoints) || 0,
      bestScore: Number(p.bestScore) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      linesCleared: Number(p.linesCleared) || 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(s: Stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadDailyData(): DailyData {
  try {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) ?? "null") as DailyData | null;
    if (!d || d.date !== todayStr()) return { date: todayStr(), plays: 0 };
    return d;
  } catch {
    return { date: todayStr(), plays: 0 };
  }
}

export function saveDailyData(d: DailyData) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(d));
  } catch {}
}

export function hoursUntilReset(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000);
}
