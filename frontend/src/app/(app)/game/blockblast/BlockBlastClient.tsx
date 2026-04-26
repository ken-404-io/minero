"use client";

import { useEffect, useRef, useState } from "react";
import { IconCoin, IconTrophy } from "@/components/icons";
import {
  startGameSession,
  finishGameSession,
  emitBalanceChange,
} from "@/lib/game-session";
import {
  type ColoredPiece,
  threeNew,
  scoreMultiplier,
  multColor,
  SCORE_CAP,
} from "./pieces";
import { G, emptyGrid, fits, fitsAnywhere, place } from "./grid";
import {
  type Stats,
  type DailyData,
  EMPTY_STATS,
  MAX_DAILY_PLAYS,
  loadStats,
  saveStats,
  loadDailyData,
  saveDailyData,
  todayStr,
  hoursUntilReset,
} from "./storage";
import { useDrag, type DragState } from "./useDrag";

const CELL = 34;
const GAP = 2;

type Status = "idle" | "playing" | "over";

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
          <div key={j} style={{ width: csz, height: csz, background: on ? color : "transparent", borderRadius: 2 }} />
        );
      })}
    </div>
  );
}

let _popId = 0;
type ScorePop = { id: number; pts: number };

export default function BlockBlastClient({ playerName: _ }: { playerName: string }) {
  const sessionIdRef = useRef<string | null>(null);
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
  const [daily, setDaily] = useState<DailyData>({ date: todayStr(), plays: 0 });

  // Drag-and-drop wiring (filled in by edit 4 — handleDrop body is a stub for now).
  const boardRef = useRef<HTMLDivElement | null>(null);
  const holdRef = useRef<HTMLButtonElement | null>(null);
  const [invalidReturn, setInvalidReturn] = useState<{
    id: number;
    piece: ColoredPiece;
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const handleDropRef = useRef<(s: DragState) => void>(() => {});
  const { drag, startDrag } = useDrag((s) => handleDropRef.current(s));

  // Snap a live drag's pointer to a board cell anchor (top-left cell of the piece).
  // Returns null when the pointer is outside the board's bounding box.
  function boardAnchorAt(d: DragState): { row: number; col: number } | null {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    const { x: px, y: py } = d.pointer;
    if (px < rect.left || px > rect.right || py < rect.top || py > rect.bottom) return null;
    const pitch = CELL + GAP;
    const pieceLeft = px - (d.grabCellC + d.subX) * pitch;
    const pieceTop = py - (d.grabCellR + d.subY) * pitch;
    return {
      row: Math.round((pieceTop - rect.top) / pitch),
      col: Math.round((pieceLeft - rect.left) / pitch),
    };
  }

  // Detect if a pointer position falls inside the hold drop zone.
  function pointerOverHold(d: DragState): boolean {
    const el = holdRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return d.pointer.x >= r.left && d.pointer.x <= r.right && d.pointer.y >= r.top && d.pointer.y <= r.bottom;
  }

  useEffect(() => {
    setStats(loadStats());
    setDaily(loadDailyData());
  }, []);

  const playsLeft = MAX_DAILY_PLAYS - daily.plays;
  const canPlay = playsLeft > 0;

  function startGame() {
    if (!canPlay) return;

    const newDaily: DailyData = { date: todayStr(), plays: daily.plays + 1 };
    setDaily(newDaily);
    saveDailyData(newDaily);

    setGrid(emptyGrid());
    setPieces(threeNew(0));
    setSel(null);
    setHeld(null);
    setScore(0);
    setLines(0);
    setHover(null);
    setClearingCells(new Map());
    setScorePops([]);
    setStatus("playing");
    sessionIdRef.current = null;
    startGameSession("blockblast").then((r) => {
      if (r.ok) sessionIdRef.current = r.sessionId;
    });
  }

  function holdPiece() {
    if (sel === null) return;
    const current = pieces[sel];
    if (!current) return;

    const next: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] = [pieces[0], pieces[1], pieces[2]];
    next[sel] = held ?? null;

    const finalPieces = next.every((p) => !p) ? threeNew(score) : next;

    setHeld(current);
    setPieces(finalPieces);
    setSel(held !== null ? sel : null);
  }

  function handleCell(row: number, col: number) {
    if (status !== "playing" || sel === null) return;
    const piece = pieces[sel];
    if (!piece || !fits(grid, piece.shape, row, col)) return;

    const { grid: ng, cleared, lines: ln } = place(grid, piece.shape, piece.color, row, col);

    // Score decay: points earned shrink as current score approaches SCORE_CAP
    const mult = scoreMultiplier(score);
    const basePts = piece.shape.length + ln * 10 + Math.max(0, ln - 1) * 5;
    const pts = Math.max(1, Math.round(basePts * mult));
    const newScore = score + pts;
    const newLines = lines + ln;

    // Clearing animation
    if (cleared.size > 0) {
      setClearingCells(new Map(cleared));
      setTimeout(() => setClearingCells(new Map()), 560);
    }

    // Score pop
    const pop: ScorePop = { id: ++_popId, pts };
    setScorePops((prev: ScorePop[]) => [...prev, pop]);
    setTimeout(() => setScorePops((prev: ScorePop[]) => prev.filter((p: ScorePop) => p.id !== pop.id)), 1150);

    // Next pieces — use newScore for difficulty escalation
    const next: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] = [pieces[0], pieces[1], pieces[2]];
    next[sel] = null;
    const finalPieces: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] =
      next.every((p) => !p) ? threeNew(newScore) : next;

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
        totalCoins: stats.totalCoins + newScore,
        bestScore: Math.max(stats.bestScore, newScore),
        gamesPlayed: stats.gamesPlayed + 1,
        linesCleared: stats.linesCleared + newLines,
      };
      setStats(s);
      saveStats(s);
      if (sessionIdRef.current) {
        const sid = sessionIdRef.current;
        sessionIdRef.current = null;
        finishGameSession(sid, newScore).then((r) => {
          if (r.ok) emitBalanceChange();
        });
      }
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
      const r = hr + dr, c = hc + dc;
      if (r >= 0 && r < G && c >= 0 && c < G) preview.add(`${r}-${c}`);
    }
  }

  const gridWidth = G * CELL + (G - 1) * GAP;
  const currentMult = scoreMultiplier(score);

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
        @keyframes bb-limitblink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>

      <header className="mb-4">
        <span className="section-title">Play</span>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Block Blast</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Place pieces to fill rows &amp; columns — clear them to earn coins!
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="kpi">
          <span className="kpi-label">Coins</span>
          <span className="kpi-value kpi-value-brand">{score}</span>
          {status === "playing" && (
            <span style={{ fontSize: 10, fontWeight: 600, color: multColor(currentMult), marginTop: 1 }}>
              ×{currentMult.toFixed(2)} coin rate
            </span>
          )}
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
            columns to clear them and earn coins! Pieces get harder and coin
            rewards decay as your total climbs — max {SCORE_CAP.toLocaleString()} coins.
          </p>

          {/* Daily plays counter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 20,
              background: canPlay
                ? "color-mix(in oklab,var(--brand) 12%,var(--surface))"
                : "color-mix(in oklab,#ef4444 12%,var(--surface))",
              border: `1px solid ${canPlay ? "var(--brand)" : "#ef4444"}`,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: canPlay ? "var(--brand)" : "#ef4444" }}>
              {canPlay
                ? `${playsLeft} of ${MAX_DAILY_PLAYS} plays left today`
                : `Daily limit reached`}
            </span>
          </div>

          {canPlay ? (
            <button className="btn btn-primary btn-lg" onClick={startGame}>
              Start Game
            </button>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)", marginBottom: 8 }}>
                Resets in ~{hoursUntilReset()} hour{hoursUntilReset() !== 1 ? "s" : ""}
              </p>
              <button className="btn btn-primary btn-lg" disabled style={{ opacity: 0.4, cursor: "not-allowed" }}>
                Come Back Tomorrow
              </button>
            </div>
          )}
        </div>
      )}

      {/* Game over banner */}
      {status === "over" && (
        <div className="card flex flex-col items-center gap-3 py-8 mb-4 text-center">
          <div style={{ fontSize: 44 }}>💥</div>
          <h2 className="text-xl font-bold">Game Over!</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Coins&nbsp;<strong>{score}</strong>&nbsp;·&nbsp;Best&nbsp;
            <strong>{stats.bestScore}</strong>
          </p>
          {canPlay ? (
            <>
              <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
                {playsLeft} of {MAX_DAILY_PLAYS} plays left today
              </p>
              <button className="btn btn-primary" onClick={startGame}>Play Again</button>
            </>
          ) : (
            <>
              <p
                className="text-sm"
                style={{
                  color: "#ef4444",
                  fontWeight: 600,
                  animation: "bb-limitblink 1.4s ease-in-out infinite",
                }}
              >
                Daily limit reached — resets in ~{hoursUntilReset()}h
              </p>
              <button className="btn btn-primary" disabled style={{ opacity: 0.4, cursor: "not-allowed" }}>
                No Plays Left
              </button>
            </>
          )}
        </div>
      )}

      {/* Board + pieces */}
      {status !== "idle" && (
        <>
          {/* Decay bar */}
          {status === "playing" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>Coin rate</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: multColor(currentMult) }}>
                  {Math.round(currentMult * 100)}%
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "var(--surface-2)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${currentMult * 100}%`,
                    background: multColor(currentMult),
                    borderRadius: 2,
                    transition: "width 400ms ease, background 400ms ease",
                  }}
                />
              </div>
            </div>
          )}

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
                    animCss = { animation: "bb-cellpop 0.56s cubic-bezier(0.34,1.56,0.64,1) forwards" };
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
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-subtle)",
                    userSelect: "none",
                  }}>
                    Hold
                  </span>
                  <button
                    onClick={holdPiece}
                    disabled={sel === null}
                    title={sel !== null ? "Hold selected piece (swap if stored)" : "Select a piece first"}
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
                    {held ? <PieceMini piece={held} /> : (
                      <span style={{ fontSize: 20, color: "var(--text-subtle)", userSelect: "none" }}>∅</span>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 54, background: "var(--border)", flexShrink: 0, alignSelf: "center" }} />

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
                              <div key={j} style={{ width: csz, height: csz, background: on ? color : "transparent", borderRadius: 2 }} />
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
          <IconCoin size={18} style={{ color: "var(--brand)" }} className="shrink-0" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {stats.gamesPlayed} played · Best {stats.bestScore} coins · {stats.linesCleared} lines cleared
          </p>
        </div>
      )}
    </div>
  );
}
