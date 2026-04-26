export type Piece = [number, number][];
export type ColoredPiece = { shape: Piece; color: string };

export const EASY_PIECES: Piece[] = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
];

export const MEDIUM_PIECES: Piece[] = [
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
];

export const HARD_PIECES: Piece[] = [
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 1], [1, 0], [1, 1], [2, 0]],
];

export const PALETTE = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

export function diffWeights(score: number): [number, number, number] {
  if (score < 1_000) return [50, 35, 15];
  if (score < 3_000) return [30, 42, 28];
  if (score < 6_000) return [15, 38, 47];
  if (score < 10_000) return [8, 28, 64];
  return [2, 15, 83];
}

export function pickPiece(score: number): Piece {
  const [we, wm, wh] = diffWeights(score);
  const r = Math.random() * (we + wm + wh);
  let pool: Piece[];
  if (r < we) pool = EASY_PIECES;
  else if (r < we + wm) pool = MEDIUM_PIECES;
  else pool = HARD_PIECES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function rndColoredPiece(score: number): ColoredPiece {
  return {
    shape: pickPiece(score),
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };
}

export function threeNew(score: number): [ColoredPiece, ColoredPiece, ColoredPiece] {
  return [rndColoredPiece(score), rndColoredPiece(score), rndColoredPiece(score)];
}

export const SCORE_CAP = 20_000;

export function scoreMultiplier(current: number): number {
  return Math.max(0.05, (SCORE_CAP - current) / SCORE_CAP);
}

export function multColor(m: number): string {
  if (m > 0.7) return "#10b981";
  if (m > 0.45) return "#f59e0b";
  if (m > 0.2) return "#f97316";
  return "#ef4444";
}

export function pieceBounds(shape: Piece): { rows: number; cols: number } {
  const maxR = Math.max(...shape.map(([r]) => r));
  const maxC = Math.max(...shape.map(([, c]) => c));
  return { rows: maxR + 1, cols: maxC + 1 };
}
