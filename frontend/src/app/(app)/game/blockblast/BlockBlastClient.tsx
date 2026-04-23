"use client";

import { useEffect, useState } from "react";
import { IconTrophy } from "@/components/icons";

/* ============================================================
   Constants
   ============================================================ */

const G = 8; // grid size 8×8
const STORAGE_KEY = "minero_blockblast_stats_v1";
const CELL = 34; // px per grid cell

/* ============================================================
   Piece definitions  [row, col] offsets from anchor (0,0)
   ============================================================ */

type Piece = [number, number][];

const ALL_PIECES: Piece[] = [
  // 1×1
  [[0, 0]],
  // 1×2
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  // 1×3
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  // 1×4
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  // 1×5
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  // 2×2
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  // 3×3
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  // L shapes
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  // Long L
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  // T
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  // S / Z
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[0, 1], [1, 0], [1, 1], [2, 0]],
];

const COLORS = ["#f59e0b", "#3b82f6", "#10b981"] as const;

/* ============================================================
   Game helpers
   ============================================================ */

function rndPiece(): Piece {
  return ALL_PIECES[Math.floor(Math.random() * ALL_PIECES.length)];
}

function three(): [Piece, Piece, Piece] {
  return [rndPiece(), rndPiece(), rndPiece()];
}

function empty(): boolean[][] {
  return Array.from({ length: G }, () => Array<boolean>(G).fill(false));
}

function fits(grid: boolean[][], piece: Piece, r: number, c: number) {
  return piece.every(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    return nr >= 0 && nr < G && nc >= 0 && nc < G && !grid[nr][nc];
  });
}

function fitsAnywhere(grid: boolean[][], piece: Piece) {
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++)
      if (fits(grid, piece, r, c)) return true;
  return false;
}

function place(
  grid: boolean[][],
  piece: Piece,
  row: number,
  col: number,
): { grid: boolean[][]; cleared: Set<string>; lines: number } {
  const g = grid.map((r) => [...r]);
  for (const [dr, dc] of piece) g[row + dr][col + dc] = true;

  const fullRows = new Set<number>();
  const fullCols = new Set<number>();
  for (let r = 0; r < G; r++) if (g[r].every(Boolean)) fullRows.add(r);
  for (let c = 0; c < G; c++) if (g.every((row) => row[c])) fullCols.add(c);

  const cleared = new Set<string>();
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++)
      if (fullRows.has(r) || fullCols.has(c)) {
        cleared.add(`${r}-${c}`);
        g[r][c] = false;
      }

  return { grid: g, cleared, lines: fullRows.size + fullCols.size };
}

/* ============================================================
   Stats
   ============================================================ */

type Stats = { totalPoints: number; bestScore: number; gamesPlayed: number; linesCleared: number };
const EMPTY: Stats = { totalPoints: 0, bestScore: 0, gamesPlayed: 0, linesCleared: 0 };

function loadStats(): Stats {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Stats> | null;
    if (!p) return EMPTY;
    return {
      totalPoints: Number(p.totalPoints) || 0,
      bestScore: Number(p.bestScore) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      linesCleared: Number(p.linesCleared) || 0,
    };
  } catch { return EMPTY; }
}

function saveStats(s: Stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

/* ============================================================
   Component
   ============================================================ */

type Status = "idle" | "playing" | "over";

export default function BlockBlastClient({ playerName: _ }: { playerName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [grid, setGrid] = useState<boolean[][]>(empty);
  const [pieces, setPieces] = useState<[Piece | null, Piece | null, Piece | null]>([null, null, null]);
  const [sel, setSel] = useState<0 | 1 | 2 | null>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => { setStats(loadStats()); }, []);

  function startGame() {
    setGrid(empty());
    setPieces(three());
    setSel(null);
    setScore(0);
    setLines(0);
    setHover(null);
    setFlash(new Set());
    setStatus("playing");
  }

  function handleCell(row: number, col: number) {
    if (status !== "playing" || sel === null) return;
    const piece = pieces[sel];
    if (!piece || !fits(grid, piece, row, col)) return;

    const { grid: ng, cleared, lines: ln } = place(grid, piece, row, col);
    const pts = piece.length + ln * 10 + Math.max(0, ln - 1) * 5;
    const newScore = score + pts;
    const newLines = lines + ln;

    if (cleared.size > 0) {
      setFlash(cleared);
      setTimeout(() => setFlash(new Set()), 380);
    }

    const next: [Piece | null, Piece | null, Piece | null] = [pieces[0], pieces[1], pieces[2]];
    next[sel] = null;
    const finalPieces = next.every((p) => !p) ? three() : next;

    const over = (finalPieces as (Piece | null)[]).every((p) => !p || !fitsAnywhere(ng, p));

    setGrid(ng);
    setPieces(finalPieces);
    setSel(null);
    setScore(newScore);
    setLines(newLines);
    setHover(null);

    if (over) {
      setStatus("over");
      const s: Stats = {
        totalPoints: stats.totalPoints + newScore,
        bestScore: Math.max(stats.bestScore, newScore),
        gamesPlayed: stats.gamesPlayed + 1,
        linesCleared: stats.linesCleared + newLines,
      };
      setStats(s);
      saveStats(s);
    }
  }

  // Preview
  const preview = new Set<string>();
  let previewOk = false;
  if (hover && sel !== null && pieces[sel]) {
    const p = pieces[sel]!;
    const [hr, hc] = hover;
    previewOk = fits(grid, p, hr, hc);
    for (const [dr, dc] of p) {
      const r = hr + dr; const c = hc + dc;
      if (r >= 0 && r < G && c >= 0 && c < G) preview.add(`${r}-${c}`);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-4">
        <span className="section-title">Play</span>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Block Blast</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Place pieces to fill rows &amp; columns — clear them to score!
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="kpi">
          <span className="kpi-label">Score</span>
          <span className="kpi-value kpi-value-brand">{score}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Best</span>
          <span className="kpi-value">{Math.max(stats.bestScore, score)}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Lines</span>
          <span className="kpi-value">{lines}</span>
        </div>
      </div>

      {/* Idle splash */}
      {status === "idle" && (
        <div className="card flex flex-col items-center gap-4 py-10 text-center">
          <div style={{ fontSize: 52 }}>🟨</div>
          <h2 className="text-xl font-bold">Block Blast</h2>
          <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>
            Select a piece below, then tap the grid to place it. Fill complete
            rows or columns to clear them and earn points!
          </p>
          <button className="btn btn-primary btn-lg" onClick={startGame}>
            Start Game
          </button>
        </div>
      )}

      {/* Game over banner */}
      {status === "over" && (
        <div className="card flex flex-col items-center gap-3 py-8 mb-4 text-center">
          <div style={{ fontSize: 44 }}>💥</div>
          <h2 className="text-xl font-bold">Game Over!</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Score&nbsp;<strong>{score}</strong>&nbsp;·&nbsp;Best&nbsp;
            <strong>{stats.bestScore}</strong>
          </p>
          <button className="btn btn-primary" onClick={startGame}>Play Again</button>
        </div>
      )}

      {/* Board + pieces */}
      {status !== "idle" && (
        <>
          {/* Grid */}
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${G}, ${CELL}px)`,
                gap: 2,
                width: "fit-content",
                margin: "0 auto 20px",
              }}
            >
              {Array.from({ length: G * G }, (_, i) => {
                const r = Math.floor(i / G);
                const c = i % G;
                const key = `${r}-${c}`;
                const filled = grid[r][c];
                const isPrev = preview.has(key);
                const isFlash = flash.has(key);

                let bg = "var(--surface-2)";
                let border = "var(--border)";
                if (isFlash) { bg = "#fde047"; border = "#facc15"; }
                else if (filled) { bg = "var(--brand)"; border = "var(--brand)"; }
                else if (isPrev && previewOk)  { bg = "color-mix(in oklab,var(--brand) 38%,transparent)"; border = "var(--brand)"; }
                else if (isPrev && !previewOk) { bg = "color-mix(in oklab,#ef4444 38%,transparent)";     border = "#ef4444"; }

                return (
                  <div
                    key={key}
                    onClick={() => handleCell(r, c)}
                    onMouseEnter={() => status === "playing" && setHover([r, c])}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      width: CELL, height: CELL,
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: 4,
                      cursor: status === "playing" && sel !== null ? "pointer" : "default",
                      transition: "background 80ms",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Pieces */}
          {status === "playing" && (
            <>
              <div className="flex justify-around items-end gap-2">
                {([0, 1, 2] as const).map((idx) => {
                  const piece = pieces[idx];
                  const color = COLORS[idx];
                  const isSelected = sel === idx;

                  if (!piece) return <div key={idx} style={{ width: 90, height: 90 }} />;

                  const maxR = Math.max(...piece.map(([r]) => r));
                  const maxC = Math.max(...piece.map(([, c]) => c));
                  const csz = Math.max(10, Math.min(20, Math.floor(70 / Math.max(maxR + 1, maxC + 1))));

                  return (
                    <button
                      key={idx}
                      onClick={() => setSel(isSelected ? null : idx)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 8,
                        borderRadius: 10,
                        border: `2px solid ${isSelected ? color : "var(--border)"}`,
                        background: isSelected
                          ? `color-mix(in oklab,${color} 18%,var(--surface))`
                          : "var(--surface)",
                        cursor: "pointer",
                        minWidth: 90,
                        minHeight: 90,
                        transition: "border-color 120ms,background 120ms",
                        transform: isSelected ? "scale(1.06)" : "scale(1)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${maxC + 1},${csz}px)`,
                          gridTemplateRows: `repeat(${maxR + 1},${csz}px)`,
                          gap: 2,
                        }}
                      >
                        {Array.from({ length: (maxR + 1) * (maxC + 1) }, (_, j) => {
                          const pr = Math.floor(j / (maxC + 1));
                          const pc = j % (maxC + 1);
                          const on = piece.some(([r, c]) => r === pr && c === pc);
                          return (
                            <div
                              key={j}
                              style={{
                                width: csz, height: csz,
                                background: on ? color : "transparent",
                                borderRadius: 2,
                              }}
                            />
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
                {sel === null
                  ? "Tap a piece to select it"
                  : "Tap the grid to place · tap piece again to deselect"}
              </p>
            </>
          )}
        </>
      )}

      {/* Lifetime stats */}
      {stats.gamesPlayed > 0 && (
        <div className="card mt-6 flex items-center gap-3">
          <IconTrophy size={18} style={{ color: "var(--brand)" }} className="shrink-0" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {stats.gamesPlayed} played · Best {stats.bestScore} pts · {stats.linesCleared} lines cleared
          </p>
        </div>
      )}
    </div>
  );
}
