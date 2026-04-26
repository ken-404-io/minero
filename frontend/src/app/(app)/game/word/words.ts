// Curated Wordscapes-style puzzles. Each puzzle has a wheel of 4–6 letters
// and a hand-authored crossword layout of target words. Bonus words are
// extra valid English words formable from the same letter pool that aren't
// in the grid — finding them earns smaller payouts.
//
// Placements use (row, col) zero-indexed cell coordinates plus a direction.
// We keep the grids small (≤6×6) so the layout fits a phone screen.

export type Direction = "h" | "v";

export type WordPlacement = {
  word: string;       // lowercase
  row: number;
  col: number;
  dir: Direction;
};

export type Puzzle = {
  /** Wheel letters (lowercase). Order is just the default render order; the
   *  client may shuffle for display. */
  letters: string[];
  /** Target words placed on the crossword grid. */
  words: WordPlacement[];
  /** Extra valid words made from the same letters that aren't on the grid. */
  bonus: string[];
};

/* ============================================================
   Curated puzzle pool
   ============================================================ */

export const PUZZLES: readonly Puzzle[] = [
  // 1 — letters: a, c, e, r, t
  {
    letters: ["a", "c", "e", "r", "t"],
    words: [
      { word: "trace", row: 0, col: 0, dir: "h" },
      { word: "cart", row: 2, col: 0, dir: "h" },
      { word: "react", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "ace", "act", "arc", "are", "art", "car", "cat", "ear", "eat",
      "era", "rat", "tar", "tea", "care", "race", "tear",
    ],
  },
  // 2 — letters: b, e, i, l, t
  {
    letters: ["b", "e", "i", "l", "t"],
    words: [
      { word: "bite", row: 0, col: 0, dir: "h" },
      { word: "tile", row: 2, col: 0, dir: "h" },
      { word: "belt", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "bet", "bit", "lit", "tie", "let", "lie", "tilt", "best",
    ],
  },
  // 3 — letters: a, l, m, p, s
  {
    letters: ["a", "l", "m", "p", "s"],
    words: [
      { word: "palms", row: 0, col: 0, dir: "h" },
      { word: "lamp", row: 2, col: 0, dir: "h" },
      { word: "slam", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "amp", "map", "pal", "lap", "alp", "amps", "maps", "alps",
      "pals", "lamps", "samp",
    ],
  },
  // 4 — letters: a, e, n, r, w
  {
    letters: ["a", "e", "n", "r", "w"],
    words: [
      { word: "warn", row: 0, col: 0, dir: "h" },
      { word: "wear", row: 2, col: 0, dir: "h" },
      { word: "wane", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "war", "raw", "ran", "ear", "era", "awe", "new", "near",
      "wane", "ware", "wean", "earn",
    ],
  },
  // 5 — letters: e, n, o, s, t
  {
    letters: ["e", "n", "o", "s", "t"],
    words: [
      { word: "notes", row: 0, col: 0, dir: "h" },
      { word: "stone", row: 2, col: 0, dir: "h" },
      { word: "tones", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "one", "ones", "ten", "set", "net", "son", "ton", "toe",
      "nest", "sent", "tons", "tens",
    ],
  },
  // 6 — letters: a, i, p, r, s
  {
    letters: ["a", "i", "p", "r", "s"],
    words: [
      { word: "pairs", row: 0, col: 0, dir: "h" },
      { word: "spar", row: 2, col: 0, dir: "h" },
      { word: "rasp", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "air", "par", "rap", "sap", "sip", "spa", "airs", "pair",
      "raps", "sari", "rips", "rips",
    ],
  },
  // 7 — letters: e, i, r, s, t, v
  {
    letters: ["e", "i", "r", "s", "t", "v"],
    words: [
      { word: "rise", row: 0, col: 2, dir: "h" },
      { word: "vest", row: 2, col: 0, dir: "h" },
      { word: "tire", row: 0, col: 5, dir: "v" },
      { word: "rites", row: 4, col: 1, dir: "h" },
      { word: "strive", row: 6, col: 0, dir: "h" },
    ],
    bonus: [
      "set", "sir", "tie", "rest", "tire", "vise", "site", "stir",
      "rive", "tier", "vies", "rites", "vest",
    ],
  },
  // 8 — letters: a, d, e, h, r
  {
    letters: ["a", "d", "e", "h", "r"],
    words: [
      { word: "heard", row: 0, col: 0, dir: "h" },
      { word: "dare", row: 2, col: 0, dir: "h" },
      { word: "head", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "had", "her", "red", "are", "ear", "era", "hare", "dear",
      "read", "herd", "hare", "rear",
    ],
  },
  // 9 — letters: a, l, o, p, r
  {
    letters: ["a", "l", "o", "p", "r"],
    words: [
      { word: "polar", row: 0, col: 0, dir: "h" },
      { word: "oral", row: 2, col: 0, dir: "h" },
      { word: "pal", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "lap", "par", "rap", "lop", "pro", "opal", "loap", "roap",
      "oral", "pals", "lop",
    ],
  },
  // 10 — letters: a, c, h, n, r
  {
    letters: ["a", "c", "h", "n", "r"],
    words: [
      { word: "ranch", row: 0, col: 0, dir: "h" },
      { word: "char", row: 2, col: 0, dir: "h" },
      { word: "arch", row: 4, col: 0, dir: "h" },
    ],
    bonus: [
      "can", "ran", "arc", "car", "cab", "char", "ranch", "chan",
    ],
  },
];

/* ============================================================
   Day → puzzle mapping
   ============================================================ */

export function utcDayIndex(ts: number): number {
  return Math.floor(ts / 86_400_000);
}

export function puzzleForDay(ts: number): Puzzle {
  // Stable offset so the first day doesn't always pick puzzle 0.
  const OFFSET = 7;
  const idx = (utcDayIndex(ts) + OFFSET) % PUZZLES.length;
  return PUZZLES[idx];
}

/**
 * Puzzle for a given level number. Level 0 is always the easiest puzzle
 * in the curated pool; higher levels walk forward through PUZZLES so the
 * difficulty ramps the further the player goes. dayIndex is intentionally
 * NOT mixed in here — daily rotation made the starting puzzle change every
 * day, which left players stuck if they couldn't clear today's seed.
 */
export function puzzleForLevel(level: number): Puzzle {
  const len = PUZZLES.length;
  const idx = (((level % len) + len) % len);
  return PUZZLES[idx];
}

/* ============================================================
   Helpers
   ============================================================ */

export type Cell = {
  letter: string;
  /** Which placed words include this cell (by index into puzzle.words). */
  wordIdx: number[];
};

/** Build a sparse map of (row,col) → cell info from a puzzle's placements. */
export function gridCells(puzzle: Puzzle): Map<string, Cell> {
  const map = new Map<string, Cell>();
  puzzle.words.forEach((w, wi) => {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === "h" ? w.row : w.row + i;
      const c = w.dir === "h" ? w.col + i : w.col;
      const key = `${r},${c}`;
      const existing = map.get(key);
      if (existing) {
        existing.wordIdx.push(wi);
      } else {
        map.set(key, { letter: w.word[i], wordIdx: [wi] });
      }
    }
  });
  return map;
}

export function gridBounds(puzzle: Puzzle): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const w of puzzle.words) {
    const endR = w.dir === "v" ? w.row + w.word.length : w.row + 1;
    const endC = w.dir === "h" ? w.col + w.word.length : w.col + 1;
    if (endR > rows) rows = endR;
    if (endC > cols) cols = endC;
  }
  return { rows, cols };
}

/** Multiset count of letters available on the wheel. */
function letterCounts(letters: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of letters) out[l] = (out[l] || 0) + 1;
  return out;
}

/** Whether `word` can be spelled by selecting from the wheel without reuse. */
export function canFormWord(puzzle: Puzzle, word: string): boolean {
  const counts = letterCounts(puzzle.letters);
  for (const ch of word) {
    if (!counts[ch]) return false;
    counts[ch]--;
  }
  return true;
}

const norm = (s: string) => s.toLowerCase();

export function isPuzzleWord(puzzle: Puzzle, word: string): number {
  const w = norm(word);
  return puzzle.words.findIndex((p) => p.word === w);
}

export function isBonusWord(puzzle: Puzzle, word: string): boolean {
  const w = norm(word);
  return puzzle.bonus.includes(w);
}
