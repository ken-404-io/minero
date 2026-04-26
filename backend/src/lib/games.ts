// Server-side reward table for each game. The client is never trusted to
// compute coinsEarned — it reports a score, and the server clamps + converts
// according to these rules.
//
// Values are intentionally conservative. Tune via admin once real play data
// lands; the daily redemption cap in redeem.ts (₱100/day) is the ultimate
// ceiling on payout regardless of what these award.

export type GameKey =
  | "trivia"
  | "spin"
  | "memory"
  | "minesweeper"
  | "word"
  | "blockblast";

export type GameRewardConfig = {
  /** Upper bound on coinsEarned a single finished session can award. */
  maxCoinsPerSession: number;
  /** Minimum elapsed time between start and finish, guards against instant-win scripts. */
  minDurationMs: number;
  /** Max coins a user can earn from this game per UTC day. */
  dailyCoinCap: number;
  /** Minimum cooldown between two finished sessions of this game. */
  cooldownMs: number;
  /** Hard cap on the raw score the client may report. */
  maxScore: number;
  /** Coins awarded per unit of score (after clamping). */
  coinsPerScore: number;
};

export const GAME_CONFIG: Record<GameKey, GameRewardConfig> = {
  trivia: {
    maxCoinsPerSession: 500,
    minDurationMs: 15_000,
    dailyCoinCap: 3_000,
    cooldownMs: 30_000,
    maxScore: 1_000,
    coinsPerScore: 0.5,
  },
  spin: {
    // One spin per 24h. Prize is server-rolled, so score is ignored.
    maxCoinsPerSession: 250,
    minDurationMs: 0,
    dailyCoinCap: 250,
    cooldownMs: 24 * 60 * 60 * 1000,
    maxScore: 0,
    coinsPerScore: 0,
  },
  memory: {
    maxCoinsPerSession: 300,
    minDurationMs: 10_000,
    dailyCoinCap: 2_000,
    cooldownMs: 15_000,
    maxScore: 1_000,
    coinsPerScore: 0.3,
  },
  minesweeper: {
    maxCoinsPerSession: 400,
    minDurationMs: 10_000,
    dailyCoinCap: 2_000,
    cooldownMs: 15_000,
    maxScore: 1_000,
    coinsPerScore: 0.4,
  },
  word: {
    // Daily puzzle — one reward per day.
    maxCoinsPerSession: 500,
    minDurationMs: 15_000,
    dailyCoinCap: 500,
    cooldownMs: 24 * 60 * 60 * 1000,
    maxScore: 500,
    coinsPerScore: 1,
  },
  blockblast: {
    maxCoinsPerSession: 500,
    minDurationMs: 20_000,
    dailyCoinCap: 2_500,
    cooldownMs: 15_000,
    maxScore: 5_000,
    coinsPerScore: 0.1,
  },
};

export const VALID_GAME_KEYS = Object.keys(GAME_CONFIG) as GameKey[];

export function isGameKey(v: unknown): v is GameKey {
  return typeof v === "string" && v in GAME_CONFIG;
}

/**
 * Convert a raw game score into coinsEarned, applying per-game caps.
 * Spin is special — it uses a server-rolled prize, not a client score.
 */
export function scoreToCoins(gameKey: GameKey, score: number): number {
  const cfg = GAME_CONFIG[gameKey];
  if (gameKey === "spin") return rollSpinPrize();
  const clamped = Math.max(0, Math.min(score, cfg.maxScore));
  const coins = Math.floor(clamped * cfg.coinsPerScore);
  return Math.min(coins, cfg.maxCoinsPerSession);
}

// Weighted prize roll for Daily Spin. Expected value ~45 coins.
// Kept server-side so a tampered client can't pick its own prize.
const SPIN_PRIZES: Array<{ coins: number; weight: number }> = [
  { coins: 10, weight: 40 },
  { coins: 25, weight: 30 },
  { coins: 50, weight: 15 },
  { coins: 100, weight: 10 },
  { coins: 250, weight: 5 },
];

export function rollSpinPrize(): number {
  const total = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of SPIN_PRIZES) {
    if ((r -= p.weight) < 0) return p.coins;
  }
  return SPIN_PRIZES[0].coins;
}
