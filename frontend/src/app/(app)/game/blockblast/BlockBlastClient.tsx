"use client";

import { useEffect, useState } from "react";
import { IconTrophy } from "@/components/icons";

/* ============================================================
   Constants
   ============================================================ */

const G = 8;
const STORAGE_KEY = "minero_blockblast_stats_v1";
const CELL = 34;
const GAP = 2;

/* ============================================================
   Types & Piece definitions
   ============================================================ */

type Piece = [number, number][];
type ColoredPiece = { shape: Piece; color: string };
type Stats = { totalPoints: number; bestScore: number; gamesPlayed: number; linesCleared: number };
type Status = "idle" | "playing" | "over";

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
  [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
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

const PALETTE = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#a855f7", // purple
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

const EMPTY_STATS: Stats = { totalPoints: 0, bestScore: 0, gamesPlayed: 0, linesCleared: 0 };

/* ============================================================
   Game helpers
   ============================================================ */

function rndColoredPiece(): ColoredPiece {
  return {
    shape: ALL_PIECES[Math.floor(Math.random() * ALL_PIECES.length)],
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };
}

function threeNew(): [ColoredPiece, ColoredPiece, ColoredPiece] {
  return [rndColoredPiece(), rndColoredPiece(), rndColoredPiece()];
}

function emptyGrid(): (string | null)[][] {
  return Array.from({ length: G }, () => Array<string | null>(G).fill(null));
}

function fits(grid: (string | null)[][], piece: Piece, r: number, c: number) {
  return piece.every(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    return nr >= 0 && nr < G && nc >= 0 && nc < G && grid[nr][nc] === null;
  });
}

function fitsAnywhere(grid: (string | null)[][], piece: Piece) {
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++)
      if (fits(grid, piece, r, c)) return true;
  return false;
}

function place(
  grid: (string | null)[][],
  piece: Piece,
  color: string,
  row: number,
  col: number,
): { grid: (string | null)[][]; cleared: Map<string, string>; lines: number } {
  const g = grid.map((r) => [...r]);
  for (const [dr, dc] of piece) g[row + dr][col + dc] = color;

  const fullRows = new Set<number>();
  const fullCols = new Set<number>();
  for (let r = 0; r < G; r++) if (g[r].every((v) => v !== null)) fullRows.add(r);
  for (let c = 0; c < G; c++) if (g.every((row) => row[c] !== null)) fullCols.add(c);

  const cleared = new Map<string, string>();
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++)
      if (fullRows.has(r) || fullCols.has(c)) {
        cleared.set(`${r}-${c}`, g[r][c] as string);
        g[r][c] = null;
      }

  return { grid: g, cleared, lines: fullRows.size + fullCols.size };
}

/* ============================================================
   Stats helpers
   ============================================================ */

function loadStats(): Stats {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Stats> | null;
    if (!p) return EMPTY_STATS;
    return {
      totalPoints: Number(p.totalPoints) || 0,
      bestScore: Number(p.bestScore) || 0,
      gamesPlayed: Number(p.gamesPlayed) || 0,
      linesCleared: Number(p.linesCleared) || 0,
    };
  } catch { return EMPTY_STATS; }
}

function saveStats(s: Stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

/* ============================================================
   Sub-components
   ============================================================ */

function PieceMini({ piece }: { piece: ColoredPiece }) {
  const { shape, color } = piece;
  const maxR = Math.max(...shape.map(([r]) => r));
  const maxC = Math.max(...shape.map(([, c]) => c));
  const csz = Math.max(8, Math.min(16, Math.floor(56 / Math.max(maxR + 1, maxC + 1))));
  return (
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
        const on = shape.some(([r, c]) => r === pr && c === pc);
        return (
          <div
            key={j}
            style={{ width: csz, height: csz, background: on ? color : "transparent", borderRadius: 2 }}
          />
        );
      })}
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */

let _popId = 0;
type ScorePop = { id: number; pts: number };

export default function BlockBlastClient({ playerName: _ }: { playerName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [grid, setGrid] = useState<(string | null)[][]>(emptyGrid);
  const [pieces, setPieces] = useState<[ColoredPiece | null, ColoredPiece | null, ColoredPiece | null]>([null, null, null]);
  const [sel, setSel] = useState<0 | 1 | 2 | null>(null);
  const [held, setHeld] = useState<ColoredPiece | null>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [clearingCells, setClearingCells] = useState<Map<string, string>>(new Map());
  const [scorePops, setScorePops] = useState<ScorePop[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  useEffect(() => { setStats(loadStats()); }, []);

  function startGame() {
    setGrid(emptyGrid());
    setPieces(threeNew());
    setSel(null);
    setHeld(null);
    setScore(0);
    setLines(0);
    setHover(null);
    setClearingCells(new Map());
    setScorePops([]);
    setStatus("playing");
  }

  function holdPiece() {
    if (sel === null) return;
    const current = pieces[sel];
    if (!current) return;

    const next: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] = [pieces[0], pieces[1], pieces[2]];
    next[sel] = held ?? null;

    // If all slots become empty after swapping, give 3 new pieces
    const finalPieces = next.every((p) => !p) ? threeNew() : next;

    setHeld(current);
    setPieces(finalPieces);
    // Keep selection only if we swapped the held piece into this slot
    setSel(held !== null ? sel : null);
  }

  function handleCell(row: number, col: number) {
    if (status !== "playing" || sel === null) return;
    const piece = pieces[sel];
    if (!piece || !fits(grid, piece.shape, row, col)) return;

    const { grid: ng, cleared, lines: ln } = place(grid, piece.shape, piece.color, row, col);
    const pts = piece.shape.length + ln * 10 + Math.max(0, ln - 1) * 5;
    const newScore = score + pts;
    const newLines = lines + ln;

    // Clearing animation
    if (cleared.size > 0) {
      setClearingCells(new Map(cleared));
      setTimeout(() => setClearingCells(new Map()), 560);
    }

    // Score pop
    const pop: ScorePop = { id: ++_popId, pts };
    setScorePops((prev) => [...prev, pop]);
    setTimeout(() => setScorePops((prev) => prev.filter((p) => p.id !== pop.id)), 1150);

    // Next pieces
    const next: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] = [pieces[0], pieces[1], pieces[2]];
    next[sel] = null;
    const finalPieces: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] =
      next.every((p) => !p) ? threeNew() : next;

    // Game over if no piece in queue fits AND held piece doesn't fit either
    const queueOver = finalPieces.every((p) => !p || !fitsAnywhere(ng, p.shape));
    const heldFits = held !== null ? fitsAnywhere(ng, held.shape) : false;
    const over = queueOver && !heldFits;

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

  // Compute preview
  const preview = new Set<string>();
  let previewOk = false;
  let previewColor = "";
  if (hover && sel !== null && pieces[sel]) {
    const p = pieces[sel]!;
    const [hr, hc] = hover;
    previewOk = fits(grid, p.shape, hr, hc);
    previewColor = p.color;
    for (const [dr, dc] of p.shape) {
      const r = hr + dr;
      const c = hc + dc;
      if (r >= 0 && r < G && c >= 0 && c < G) preview.add(`${r}-${c}`);
    }
  }

  const gridWidth = G * CELL + (G - 1) * GAP;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 lg:px-8 lg:py-8">
      <style>{`
        @keyframes bb-cellpop {
          0%   { transform: scale(1);    opacity: 1; }
          30%  { transform: scale(1.5);  opacity: 1; }
          60%  { transform: scale(1.15); opacity: 0.6; }
          100% { transform: scale(0);    opacity: 0; }
        }
        @keyframes bb-scorefly {
          0%   { transform: translate(-50%, 0)     scale(1);    opacity: 1; }
          18%  { transform: translate(-50%, -16px) scale(1.4);  opacity: 1; }
          100% { transform: translate(-50%, -80px) scale(0.85); opacity: 0; }
        }
      `}</style>

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
            Select a piece, then tap the grid to place it. Fill complete rows or
            columns to clear them and score! Use Hold to save a piece for later.
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
            <div style={{ position: "relative", width: gridWidth, margin: "0 auto 20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${G}, ${CELL}px)`,
                  gap: GAP,
                }}
              >
                {Array.from({ length: G * G }, (_, i) => {
                  const r = Math.floor(i / G);
                  const c = i % G;
                  const key = `${r}-${c}`;
                  const cellColor = grid[r][c];
                  const isPrev = preview.has(key);
                  const clearColor = clearingCells.get(key);

                  let bg = "var(--surface-2)";
                  let border = "var(--border)";
                  let animCss: React.CSSProperties = {};

                  if (clearColor !== undefined) {
                    bg = clearColor;
                    border = clearColor;
                    animCss = {
                      animation: "bb-cellpop 0.56s cubic-bezier(0.34,1.56,0.64,1) forwards",
                    };
                  } else if (cellColor) {
                    bg = cellColor;
                    border = cellColor;
                  } else if (isPrev && previewOk) {
                    bg = `color-mix(in oklab,${previewColor} 42%,transparent)`;
                    border = previewColor;
                  } else if (isPrev && !previewOk) {
                    bg = "color-mix(in oklab,#ef4444 38%,transparent)";
                    border = "#ef4444";
                  }

                  return (
                    <div
                      key={key}
                      onClick={() => handleCell(r, c)}
                      onMouseEnter={() => status === "playing" && setHover([r, c])}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        width: CELL,
                        height: CELL,
                        background: bg,
                        border: `1px solid ${border}`,
                        borderRadius: 4,
                        cursor: status === "playing" && sel !== null ? "pointer" : "default",
                        transition: clearColor !== undefined ? "none" : "background 80ms",
                        ...animCss,
                      }}
                    />
                  );
                })}
              </div>

              {/* Score pop-up overlays */}
              {scorePops.map((pop) => (
                <div
                  key={pop.id}
                  style={{
                    position: "absolute",
                    bottom: "12%",
                    left: "50%",
                    fontWeight: 800,
                    fontSize: "1.75rem",
                    color: "#fde047",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    textShadow: "0 2px 16px rgba(0,0,0,0.8), 0 0 8px rgba(253,224,71,0.6)",
                    animation: "bb-scorefly 1.15s cubic-bezier(0.2,0,0.4,1) forwards",
                    zIndex: 10,
                  }}
                >
                  +{pop.pts}
                </div>
              ))}
            </div>
          </div>

          {/* Pieces + Hold */}
          {status === "playing" && (
            <>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", justifyContent: "center" }}>
                {/* Hold slot */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--text-subtle)",
                      userSelect: "none",
                    }}
                  >
                    Hold
                  </span>
                  <button
                    onClick={holdPiece}
                    disabled={sel === null}
                    title={sel !== null ? "Hold selected piece (swap if one is stored)" : "Select a piece first"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 76,
                      height: 76,
                      borderRadius: 10,
                      border: `2px dashed ${held ? "var(--brand)" : "var(--border)"}`,
                      background: held
                        ? "color-mix(in oklab,var(--brand) 12%,var(--surface))"
                        : "var(--surface)",
                      cursor: sel !== null ? "pointer" : "not-allowed",
                      opacity: sel === null ? 0.4 : 1,
                      transition: "opacity 150ms, border-color 150ms, background 150ms",
                    }}
                  >
                    {held ? (
                      <PieceMini piece={held} />
                    ) : (
                      <span style={{ fontSize: 20, color: "var(--text-subtle)", userSelect: "none" }}>∅</span>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div
                  style={{
                    width: 1,
                    height: 54,
                    background: "var(--border)",
                    flexShrink: 0,
                    alignSelf: "center",
                  }}
                />

                {/* Piece queue */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flex: 1, justifyContent: "space-around" }}>
                  {([0, 1, 2] as const).map((idx) => {
                    const piece = pieces[idx];
                    const isSelected = sel === idx;

                    if (!piece) return <div key={idx} style={{ width: 82, height: 82 }} />;

                    const { shape, color } = piece;
                    const maxR = Math.max(...shape.map(([r]) => r));
                    const maxC = Math.max(...shape.map(([, c]) => c));
                    const csz = Math.max(10, Math.min(20, Math.floor(68 / Math.max(maxR + 1, maxC + 1))));

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
                          minWidth: 82,
                          minHeight: 82,
                          transition: "border-color 120ms, background 120ms, transform 120ms",
                          transform: isSelected ? "scale(1.08)" : "scale(1)",
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
                            const on = shape.some(([r, c]) => r === pr && c === pc);
                            return (
                              <div
                                key={j}
                                style={{
                                  width: csz,
                                  height: csz,
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
              </div>

              <p className="text-center text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
                {sel === null
                  ? "Tap a piece to select · tap Hold to save for later"
                  : "Tap the grid to place · Hold to swap · tap piece to deselect"}
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
