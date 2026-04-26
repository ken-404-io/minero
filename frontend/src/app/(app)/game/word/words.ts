// Curated Wordscapes-style puzzles. Each puzzle has a wheel of 3–6 letters
// and a hand-authored crossword layout where target words intersect at
// shared cells. Bonus words are extra valid English words formable from
// the same letter pool that aren't in the grid — finding them earns
// smaller payouts.
//
// Placements use (row, col) zero-indexed cell coordinates plus a direction.
// `validatePuzzle` runs at module load and console.warn's any layout that
// has overlapping-cell letter conflicts or words using letters outside
// the wheel pool, so authoring mistakes show up immediately in dev.

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
   Curated puzzle pool — easy → hard
   ------------------------------------------------------------
   Tier 1 (1–4):   3 letters, 2–3 short words. Tutorial.
   Tier 2 (5–10):  4 letters, 3–4 words, single-letter intersections.
   Tier 3 (11–17): 5 letters, 3–5 words, multi-intersection grids.
   Tier 4 (18–22): 5–6 letters, 4–6 words, longer anchor words.
   ============================================================ */

export const PUZZLES: readonly Puzzle[] = [
  /* ----- Tier 1: tutorial ---------------------------------- */
  // 1 — a, t, e
  {
    letters: ["a", "t", "e"],
    words: [
      { word: "ate", row: 0, col: 0, dir: "h" },
      { word: "tea", row: 0, col: 1, dir: "v" },
      { word: "eat", row: 2, col: 0, dir: "h" },
    ],
    bonus: [],
  },
  // 2 — a, r, t
  {
    letters: ["a", "r", "t"],
    words: [
      { word: "art", row: 0, col: 0, dir: "h" },
      { word: "rat", row: 0, col: 1, dir: "v" },
      { word: "tar", row: 0, col: 2, dir: "v" },
    ],
    bonus: [],
  },
  // 3 — c, a, t (only 3 valid: CAT, ACT, TAC — tac isn't English; skip)
  // Re-using letters a, c, e, t for tier 1 finale.
  {
    letters: ["a", "c", "e", "t"],
    words: [
      { word: "cat", row: 0, col: 0, dir: "h" },
      { word: "ace", row: 0, col: 1, dir: "v" },
      { word: "tea", row: 2, col: 0, dir: "h" },
    ],
    bonus: ["ate", "eat", "act", "cate"],
  },
  // 4 — a, p, t (PAT, TAP, APT)
  {
    letters: ["a", "p", "t"],
    words: [
      { word: "pat", row: 0, col: 0, dir: "h" },
      { word: "apt", row: 0, col: 1, dir: "v" },
      { word: "tap", row: 0, col: 2, dir: "v" },
    ],
    bonus: [],
  },

  /* ----- Tier 2: 4-letter pools ---------------------------- */
  // 5 — a, p, l, e
  // PALE shares its P at (0,0) with APE going down at col 1 (A→P→E),
  // and its E at (0,3) with PEA going down at col 3.
  {
    letters: ["a", "p", "l", "e"],
    words: [
      { word: "pale", row: 0, col: 0, dir: "h" },
      { word: "leap", row: 2, col: 0, dir: "h" },
      { word: "ape", row: 0, col: 1, dir: "v" },
      { word: "pea", row: 2, col: 3, dir: "v" },
    ],
    bonus: ["plea", "pal", "ale", "lea", "alp", "peal", "lap"],
  },
  // 6 — l, a, m, p
  {
    letters: ["l", "a", "m", "p"],
    words: [
      { word: "lamp", row: 0, col: 0, dir: "h" },
      { word: "map", row: 0, col: 2, dir: "v" },
      { word: "pal", row: 2, col: 2, dir: "h" },
    ],
    bonus: ["amp", "alp", "palm", "lap"],
  },
  // 7 — c, a, r, e
  // CARE horizontal anchor; ACE drops from its A at (0,1); ERA shares the
  // ACE-E at (2,1); ARC sits independently at row 4 to round out four words.
  {
    letters: ["c", "a", "r", "e"],
    words: [
      { word: "care", row: 0, col: 0, dir: "h" },
      { word: "ace", row: 0, col: 1, dir: "v" },
      { word: "era", row: 2, col: 1, dir: "h" },
      { word: "arc", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["car", "ear", "are", "race", "acre"],
  },
  // 8 — d, e, a, r
  // DARE on top, DEAR on row 2; ARE crosses both vertically through their
  // A's, READ ties them together via R at (2,2) ↔ R at (0,2).
  {
    letters: ["d", "e", "a", "r"],
    words: [
      { word: "dare", row: 0, col: 0, dir: "h" },
      { word: "dear", row: 2, col: 0, dir: "h" },
      { word: "are", row: 0, col: 1, dir: "v" },
      { word: "read", row: 0, col: 2, dir: "v" },
    ],
    bonus: ["era", "red", "ear"],
  },
  // 9 — n, o, t, e
  // NOTE → TEN crossed through E at (2,1); TONE on row 4 gives a 4th word.
  {
    letters: ["n", "o", "t", "e"],
    words: [
      { word: "note", row: 0, col: 0, dir: "h" },
      { word: "one", row: 0, col: 1, dir: "v" },
      { word: "ten", row: 2, col: 0, dir: "h" },
      { word: "tone", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["net", "eon", "ton", "toe", "not"],
  },
  // 10 — c, h, a, t
  {
    letters: ["c", "h", "a", "t"],
    words: [
      { word: "chat", row: 0, col: 0, dir: "h" },
      { word: "cat", row: 0, col: 0, dir: "v" },
      { word: "hat", row: 0, col: 1, dir: "v" },
      { word: "act", row: 0, col: 2, dir: "v" },
    ],
    bonus: ["tach"],
  },

  /* ----- Tier 3: 5-letter pools ---------------------------- */
  // 11 — l, e, m, o, n
  {
    letters: ["l", "e", "m", "o", "n"],
    words: [
      { word: "lemon", row: 0, col: 0, dir: "h" },
      { word: "melon", row: 0, col: 2, dir: "v" },
      { word: "men", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["lone", "noel", "mole", "omen", "elm", "eon"],
  },
  // 12 — h, o, p, e, n
  {
    letters: ["h", "o", "p", "e", "n"],
    words: [
      { word: "phone", row: 0, col: 0, dir: "h" },
      { word: "hope", row: 0, col: 1, dir: "v" },
      { word: "open", row: 0, col: 2, dir: "v" },
      { word: "hone", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["pen", "hop", "hoe", "nope", "eon"],
  },
  // 13 — t, a, b, l, e
  {
    letters: ["t", "a", "b", "l", "e"],
    words: [
      { word: "table", row: 0, col: 0, dir: "h" },
      { word: "able", row: 0, col: 1, dir: "v" },
      { word: "bat", row: 0, col: 2, dir: "v" },
      { word: "bleat", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["bate", "beat", "belt", "bale", "late", "teal", "bet", "ale", "let", "ate", "eat", "tea", "abet"],
  },
  // 14 — c, l, o, u, d
  // CLOUD over COULD; DUO sits independently below since it doesn't share
  // a consistent letter with either anchor.
  {
    letters: ["c", "l", "o", "u", "d"],
    words: [
      { word: "cloud", row: 0, col: 0, dir: "h" },
      { word: "could", row: 2, col: 0, dir: "h" },
      { word: "duo", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["cud", "old", "loud", "cod"],
  },
  // 15 — p, l, a, t, e
  {
    letters: ["p", "l", "a", "t", "e"],
    words: [
      { word: "plate", row: 0, col: 0, dir: "h" },
      { word: "petal", row: 0, col: 0, dir: "v" },
      { word: "tape", row: 2, col: 0, dir: "h" },
      { word: "late", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["leap", "peal", "peat", "teal", "ate", "eat", "tea", "ale", "lea", "alp", "lap", "pat", "tap", "pea", "ape", "pet", "apt", "pale"],
  },
  // 16 — s, t, o, n, e
  {
    letters: ["s", "t", "o", "n", "e"],
    words: [
      { word: "stone", row: 0, col: 0, dir: "h" },
      { word: "notes", row: 2, col: 0, dir: "h" },
      { word: "tones", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["one", "ten", "set", "net", "son", "ton", "toe", "nest", "sent", "tens", "nose", "noes"],
  },
  // 17 — h, e, a, r, t
  // HEART, then RATE drops from its R at (0,3); EARTH on row 2 shares
  // RATE's T at (2,3). Tight 3-word interlock.
  {
    letters: ["h", "e", "a", "r", "t"],
    words: [
      { word: "heart", row: 0, col: 0, dir: "h" },
      { word: "rate", row: 0, col: 3, dir: "v" },
      { word: "earth", row: 2, col: 0, dir: "h" },
    ],
    bonus: ["hate", "tear", "hear", "hare", "heat", "art", "ate", "eat", "ear", "era", "tea", "hat", "rat", "tar", "her", "the"],
  },

  /* ----- Tier 4: 5–6 letter pools, denser layouts ---------- */
  // 18 — w, o, r, l, d
  {
    letters: ["w", "o", "r", "l", "d"],
    words: [
      { word: "world", row: 0, col: 0, dir: "h" },
      { word: "word", row: 2, col: 0, dir: "h" },
      { word: "lord", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["row", "low", "old", "owl", "rod"],
  },
  // 19 — d, r, e, a, m
  // DREAM and ARMED on rows 0/2; MADE drops from M at (0,4), tying through
  // ARMED's D at (2,4).
  {
    letters: ["d", "r", "e", "a", "m"],
    words: [
      { word: "dream", row: 0, col: 0, dir: "h" },
      { word: "armed", row: 2, col: 0, dir: "h" },
      { word: "made", row: 0, col: 4, dir: "v" },
    ],
    bonus: ["dare", "dear", "read", "mead", "mare", "mar", "arm", "ear", "are", "era", "red", "mad", "ram"],
  },
  // 20 — s, t, r, i, v, e
  // STRIVE anchor; TIES drops from its T (col 1); RISE crosses VEST at S
  // (2,4); VEST drops from STRIVE's V (col 4); VIES sits at row 4.
  {
    letters: ["s", "t", "r", "i", "v", "e"],
    words: [
      { word: "strive", row: 0, col: 0, dir: "h" },
      { word: "ties", row: 0, col: 1, dir: "v" },
      { word: "rise", row: 2, col: 2, dir: "h" },
      { word: "vest", row: 0, col: 4, dir: "v" },
      { word: "vies", row: 4, col: 2, dir: "h" },
    ],
    bonus: ["set", "sir", "tie", "tire", "vise", "site", "stir", "rive", "tier", "rest", "its", "vet", "rite", "rites"],
  },
  // 21 — p, l, a, n, e, t
  // PLANET anchor; PLAN drops from P at (0,0); TALE drops from PLANET's
  // T at (0,5); NEAT row 3 starts at PLAN's N.
  {
    letters: ["p", "l", "a", "n", "e", "t"],
    words: [
      { word: "planet", row: 0, col: 0, dir: "h" },
      { word: "plan", row: 0, col: 0, dir: "v" },
      { word: "tale", row: 0, col: 5, dir: "v" },
      { word: "neat", row: 3, col: 0, dir: "h" },
    ],
    bonus: ["pet", "let", "net", "ten", "ant", "apt", "ale", "lea", "ate", "eat", "tea", "lane", "late", "leap", "peal", "plate", "plant", "panel", "leant"],
  },
  // 22 — g, a, r, d, e, n
  // GARDEN anchor; RANGED drops from R at (0,2); AGE on row 4 ties through
  // RANGED's E at (4,2).
  {
    letters: ["g", "a", "r", "d", "e", "n"],
    words: [
      { word: "garden", row: 0, col: 0, dir: "h" },
      { word: "ranged", row: 0, col: 2, dir: "v" },
      { word: "age", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["are", "ear", "era", "end", "ran", "rag", "red", "dare", "dear", "earn", "gear", "near", "rage", "rang", "read", "danger", "grand", "anger", "range"],
  },
  // 23 — c, a, n, d, l, e
  // Four 5-letter anagrams (CANDLE is 6) stacked horizontally with no
  // overlapping cells — the wheel layout gives the "puzzle" feel via the
  // wide list of words that all use the same six letters.
  {
    letters: ["c", "a", "n", "d", "l", "e"],
    words: [
      { word: "candle", row: 0, col: 0, dir: "h" },
      { word: "lance", row: 2, col: 0, dir: "h" },
      { word: "clean", row: 4, col: 0, dir: "h" },
      { word: "dance", row: 6, col: 0, dir: "h" },
    ],
    bonus: ["ace", "and", "can", "den", "end", "lad", "lac", "lea", "ale", "cad", "lend", "lead", "deal", "lean", "lace", "cane", "acne", "laced", "decal"],
  },
  // 24 — o, c, e, a, n
  // OCEAN/CANOE/ACNE stacked; EON drops from OCEAN's E (col 2) and crosses
  // CANOE's N (2,2).
  {
    letters: ["o", "c", "e", "a", "n"],
    words: [
      { word: "ocean", row: 0, col: 0, dir: "h" },
      { word: "canoe", row: 2, col: 0, dir: "h" },
      { word: "acne", row: 4, col: 0, dir: "h" },
      { word: "eon", row: 0, col: 2, dir: "v" },
    ],
    bonus: ["ace", "can", "con", "one", "oca", "nae"],
  },
  // 25 — l, i, g, h, t
  // LIGHT anchor; HILT row 2 shares HIT's H/T cross at col 3 (HIT drops
  // from LIGHT's H); GILT independent on row 4.
  {
    letters: ["l", "i", "g", "h", "t"],
    words: [
      { word: "light", row: 0, col: 0, dir: "h" },
      { word: "hit", row: 0, col: 3, dir: "v" },
      { word: "gilt", row: 4, col: 0, dir: "h" },
    ],
    bonus: ["lit", "git", "hi", "it"],
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

/* ============================================================
   Validator (dev-only) — catches placement bugs at module load
   ------------------------------------------------------------
   For every puzzle, we walk each word's cells and check:
     1. Two words sharing a cell agree on the letter at that cell.
     2. Every letter of every placed word is present (with multiplicity)
        in the wheel pool.
     3. Every bonus word can be formed from the wheel pool.
   On a violation we console.warn so the author sees it immediately
   when the page loads in dev. We don't throw — the puzzle is still
   playable, just visually inconsistent.
   ============================================================ */

export function validatePuzzle(p: Puzzle, label: string): string[] {
  const errors: string[] = [];
  const cells = new Map<string, string>();
  const counts = letterCounts(p.letters);

  p.words.forEach((w, wi) => {
    // 1. Cell agreement at intersections.
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === "h" ? w.row : w.row + i;
      const c = w.dir === "h" ? w.col + i : w.col;
      const key = `${r},${c}`;
      const ch = w.word[i];
      const existing = cells.get(key);
      if (existing && existing !== ch) {
        errors.push(
          `${label}: word #${wi} "${w.word}" conflicts at (${r},${c}): "${existing}" vs "${ch}"`,
        );
      }
      cells.set(key, ch);
    }

    // 2. Word letters present in pool (with multiplicity).
    const wc = letterCounts(w.word.split(""));
    for (const [ch, n] of Object.entries(wc)) {
      if ((counts[ch] || 0) < n) {
        errors.push(
          `${label}: word #${wi} "${w.word}" needs '${ch}' x${n} but pool has x${counts[ch] || 0}`,
        );
      }
    }
  });

  // 3. Bonus-word formability.
  for (const b of p.bonus) {
    if (!canFormWord(p, b)) {
      errors.push(`${label}: bonus "${b}" can't be formed from pool`);
    }
  }

  return errors;
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  PUZZLES.forEach((p, i) => {
    const errs = validatePuzzle(p, `Puzzle #${i + 1}`);
    if (errs.length) {
      // Surfacing once per problem keeps the console readable; full list
      // is grouped under a single warn so it's easy to scan.
      console.warn(`[word puzzles] ${errs.length} issue(s) in puzzle #${i + 1}:\n${errs.join("\n")}`);
    }
  });
}
