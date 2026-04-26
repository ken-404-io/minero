import type { Piece } from "./pieces";

export const G = 8;
export type Cell = string | null;
export type Grid = Cell[][];

export function emptyGrid(): Grid {
  return Array.from({ length: G }, () => Array<Cell>(G).fill(null));
}

export function fits(grid: Grid, piece: Piece, r: number, c: number): boolean {
  return piece.every(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    return nr >= 0 && nr < G && nc >= 0 && nc < G && grid[nr][nc] === null;
  });
}

export function fitsAnywhere(grid: Grid, piece: Piece): boolean {
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++)
      if (fits(grid, piece, r, c)) return true;
  return false;
}

export type PlaceResult = {
  grid: Grid;
  cleared: Map<string, string>;
  lines: number;
  rows: number[];
  cols: number[];
};

export function place(
  grid: Grid,
  piece: Piece,
  color: string,
  row: number,
  col: number,
): PlaceResult {
  const g = grid.map((r) => [...r]);
  for (const [dr, dc] of piece) g[row + dr][col + dc] = color;

  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let r = 0; r < G; r++) if (g[r].every((v) => v !== null)) fullRows.push(r);
  for (let c = 0; c < G; c++) if (g.every((row) => row[c] !== null)) fullCols.push(c);

  const cleared = new Map<string, string>();
  const rowSet = new Set(fullRows);
  const colSet = new Set(fullCols);
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++)
      if (rowSet.has(r) || colSet.has(c)) {
        cleared.set(`${r}-${c}`, g[r][c] as string);
        g[r][c] = null;
      }

  return { grid: g, cleared, lines: fullRows.length + fullCols.length, rows: fullRows, cols: fullCols };
}

/**
 * Predict which rows/cols would clear if `piece` is placed at (row, col).
 * Used by the live preview — does NOT mutate the input grid.
 */
export function predictClears(
  grid: Grid,
  piece: Piece,
  row: number,
  col: number,
): { rows: Set<number>; cols: Set<number> } {
  const occ = new Set<string>();
  for (const [dr, dc] of piece) occ.add(`${row + dr}-${col + dc}`);

  const filled = (r: number, c: number) =>
    grid[r][c] !== null || occ.has(`${r}-${c}`);

  const rows = new Set<number>();
  const cols = new Set<number>();
  for (let r = 0; r < G; r++) {
    let full = true;
    for (let c = 0; c < G; c++) if (!filled(r, c)) { full = false; break; }
    if (full) rows.add(r);
  }
  for (let c = 0; c < G; c++) {
    let full = true;
    for (let r = 0; r < G; r++) if (!filled(r, c)) { full = false; break; }
    if (full) cols.add(c);
  }
  return { rows, cols };
}
