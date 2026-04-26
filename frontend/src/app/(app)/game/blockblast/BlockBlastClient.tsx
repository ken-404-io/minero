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
import { G, emptyGrid, fits, fitsAnywhere, place, predictClears } from "./grid";
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
  const [held, setHeld] = useState<ColoredPiece | null>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [clearingCells, setClearingCells] = useState<Map<string, string>>(new Map());
  const [settleCells, setSettleCells] = useState<Set<string>>(new Set());
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
    setHeld(null);
    setScore(0);
    setLines(0);
    setClearingCells(new Map());
    setSettleCells(new Set());
    setScorePops([]);
    setStatus("playing");
    sessionIdRef.current = null;
    startGameSession("blockblast").then((r) => {
      if (r.ok) sessionIdRef.current = r.sessionId;
    });
  }

  function handleDrop(d: DragState) {
    if (status !== "playing") return;
    const piece = d.piece;

    // Hold zone — only tray pieces can be sent to hold (you can't re-hold the held piece).
    if (d.source.kind === "tray" && pointerOverHold(d)) {
      const slot = d.source.slot;
      const next: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] = [pieces[0], pieces[1], pieces[2]];
      next[slot] = held ?? null;
      const finalPieces = next.every((p) => !p) ? threeNew(score) : next;
      setHeld(piece);
      setPieces(finalPieces);
      return;
    }

    const anchor = boardAnchorAt(d);
    if (!anchor || !fits(grid, piece.shape, anchor.row, anchor.col)) {
      // Snap-back animation: ghost glides from the drop point back to the source tile.
      setInvalidReturn({
        id: ++_popId,
        piece,
        from: { x: d.pointer.x, y: d.pointer.y },
        to: d.startRect,
      });
      setTimeout(() => setInvalidReturn(null), 220);
      return;
    }

    const { row, col } = anchor;
    const { grid: ng, cleared, lines: ln } = place(grid, piece.shape, piece.color, row, col);

    // Score decay: points earned shrink as current score approaches SCORE_CAP.
    const mult = scoreMultiplier(score);
    const basePts = piece.shape.length + ln * 10 + Math.max(0, ln - 1) * 5;
    const pts = Math.max(1, Math.round(basePts * mult));
    const newScore = score + pts;
    const newLines = lines + ln;

    if (cleared.size > 0) {
      setClearingCells(new Map(cleared));
      setTimeout(() => setClearingCells(new Map()), 560);
    }

    // Settle bounce on the newly placed cells that survived the clear.
    const placedKeys = new Set<string>();
    for (const [dr, dc] of piece.shape) {
      const key = `${row + dr}-${col + dc}`;
      if (!cleared.has(key)) placedKeys.add(key);
    }
    if (placedKeys.size > 0) {
      setSettleCells(placedKeys);
      setTimeout(() => setSettleCells(new Set()), 360);
    }

    const pop: ScorePop = { id: ++_popId, pts };
    setScorePops((prev) => [...prev, pop]);
    setTimeout(() => setScorePops((prev) => prev.filter((p) => p.id !== pop.id)), 1150);

    // Consume the source.
    let nextPieces: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null];
    let nextHeld = held;
    if (d.source.kind === "tray") {
      const draft: [ColoredPiece | null, ColoredPiece | null, ColoredPiece | null] = [pieces[0], pieces[1], pieces[2]];
      draft[d.source.slot] = null;
      nextPieces = draft.every((p) => !p) ? threeNew(newScore) : draft;
    } else {
      nextPieces = [pieces[0], pieces[1], pieces[2]];
      nextHeld = null;
    }

    const queueOver = nextPieces.every((p) => !p || !fitsAnywhere(ng, p.shape));
    const heldFits = nextHeld !== null ? fitsAnywhere(ng, nextHeld.shape) : false;
    const over = queueOver && !heldFits;

    setGrid(ng);
    setPieces(nextPieces);
    setHeld(nextHeld);
    setScore(newScore);
    setLines(newLines);

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
  handleDropRef.current = handleDrop;

  // Compute preview from the active drag (re-runs each pointermove via setDrag).
  const preview = new Set<string>();
  const previewClearRows = new Set<number>();
  const previewClearCols = new Set<number>();
  let previewOk = false;
  let previewColor = "";
  if (drag && status === "playing") {
    const anchor = boardAnchorAt(drag);
    if (anchor) {
      const p = drag.piece;
      previewOk = fits(grid, p.shape, anchor.row, anchor.col);
      previewColor = p.color;
      for (const [dr, dc] of p.shape) {
        const r = anchor.row + dr;
        const c = anchor.col + dc;
        if (r >= 0 && r < G && c >= 0 && c < G) preview.add(`${r}-${c}`);
      }
      if (previewOk) {
        const cleared = predictClears(grid, p.shape, anchor.row, anchor.col);
        cleared.rows.forEach((r) => previewClearRows.add(r));
        cleared.cols.forEach((c) => previewClearCols.add(c));
      }
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
        @keyframes bb-snapback {
          0%   { transform: translate(0, 0);                       opacity: 0.85; }
          100% { transform: translate(var(--bb-dx), var(--bb-dy)); opacity: 0;    }
        }
        @keyframes bb-clearpulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255,255,255,0.0), 0 0 0 0 rgba(255,255,255,0.0);
            filter: brightness(1);
          }
          50% {
            box-shadow:
              inset 0 0 0 2px rgba(255,255,255,0.85),
              0 0 12px 2px rgba(255,255,255,0.55);
            filter: brightness(1.25);
          }
        }
        @keyframes bb-settle {
          0%   { transform: translateY(-7px) scale(1.08); }
          55%  { transform: translateY(2px)  scale(0.96); }
          80%  { transform: translateY(-1px) scale(1.02); }
          100% { transform: translateY(0)    scale(1);    }
        }
        @keyframes bb-particle {
          0%   { transform: translate(0, 0)                       scale(1);    opacity: 0.95; }
          100% { transform: translate(var(--bb-px), var(--bb-py)) scale(0.25); opacity: 0;    }
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
                ref={boardRef}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${G}, ${CELL}px)`,
                  gap: GAP,
                  touchAction: "none",
                }}
              >
                {Array.from({ length: G * G }, (_, i) => {
                  const r = Math.floor(i / G);
                  const c = i % G;
                  const key = `${r}-${c}`;
                  const cellColor = grid[r][c];
                  const isPrev = preview.has(key);
                  const clearColor = clearingCells.get(key);

                  let bg: string = "var(--surface-2)";
                  let border = "var(--border)";
                  let extra: React.CSSProperties = {};
                  let animCss: React.CSSProperties = {};

                  // 2.5D extrusion shared by filled and preview cells.
                  const extrudeShadow =
                    "inset 0 2px 0 rgba(255,255,255,0.32), " +
                    "inset 0 -3px 0 rgba(0,0,0,0.32), " +
                    "inset -2px 0 0 rgba(0,0,0,0.18), " +
                    "0 3px 5px rgba(0,0,0,0.35)";

                  if (clearColor !== undefined) {
                    bg = `linear-gradient(180deg, color-mix(in oklab,${clearColor} 78%,white), ${clearColor} 55%, color-mix(in oklab,${clearColor} 78%,black))`;
                    border = "transparent";
                    extra = { boxShadow: extrudeShadow };
                    animCss = { animation: "bb-cellpop 0.56s cubic-bezier(0.34,1.56,0.64,1) forwards" };
                  } else if (cellColor) {
                    bg = `linear-gradient(180deg, color-mix(in oklab,${cellColor} 78%,white), ${cellColor} 55%, color-mix(in oklab,${cellColor} 78%,black))`;
                    border = "transparent";
                    extra = { boxShadow: extrudeShadow };
                  } else if (isPrev && previewOk) {
                    bg = `linear-gradient(180deg, color-mix(in oklab,${previewColor} 55%,transparent), color-mix(in oklab,${previewColor} 35%,transparent))`;
                    border = previewColor;
                    extra = {
                      boxShadow:
                        "inset 0 2px 0 rgba(255,255,255,0.18), " +
                        "inset 0 -3px 0 rgba(0,0,0,0.18), " +
                        "0 2px 4px rgba(0,0,0,0.22)",
                    };
                  } else if (isPrev && !previewOk) {
                    bg = "linear-gradient(180deg, color-mix(in oklab,#ef4444 55%,transparent), color-mix(in oklab,#ef4444 35%,transparent))";
                    border = "#ef4444";
                  }

                  // Highlight rows/columns that would clear on drop.
                  const inPreviewClear =
                    clearColor === undefined && (previewClearRows.has(r) || previewClearCols.has(c));
                  if (inPreviewClear && (cellColor || isPrev)) {
                    animCss = { animation: "bb-clearpulse 0.9s ease-in-out infinite" };
                  } else if (clearColor === undefined && settleCells.has(key)) {
                    animCss = { animation: "bb-settle 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards" };
                  }

                  return (
                    <div
                      key={key}
                      style={{
                        width: CELL,
                        height: CELL,
                        background: bg,
                        border: `1px solid ${border}`,
                        borderRadius: 5,
                        transition: clearColor !== undefined ? "none" : "background 80ms",
                        ...extra,
                        ...animCss,
                      }}
                    />
                  );
                })}
              </div>

              {/* Particle burst on row/column clear */}
              {clearingCells.size > 0 && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {Array.from(clearingCells.entries()).flatMap(([key, color]) => {
                    const [pr, pc] = key.split("-").map(Number);
                    const cx = pc * (CELL + GAP) + CELL / 2;
                    const cy = pr * (CELL + GAP) + CELL / 2;
                    const dirs: [number, number][] = [
                      [22, 0], [-22, 0], [0, 22], [0, -22],
                      [16, 16], [-16, 16], [16, -16], [-16, -16],
                    ];
                    return dirs.map(([dx, dy], i) => (
                      <div
                        key={`${key}-p${i}`}
                        style={{
                          position: "absolute",
                          left: cx - 3,
                          top: cy - 3,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: color,
                          boxShadow: `0 0 8px 1px ${color}`,
                          animation: "bb-particle 0.6s ease-out forwards",
                          ["--bb-px" as string]: `${dx}px`,
                          ["--bb-py" as string]: `${dy}px`,
                        } as React.CSSProperties}
                      />
                    ));
                  })}
                </div>
              )}

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
                    ref={holdRef}
                    type="button"
                    title="Drag a piece here to store it"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 76,
                      height: 76,
                      borderRadius: 10,
                      border: `2px dashed ${(drag && pointerOverHold(drag)) ? "var(--brand)" : held ? "var(--brand)" : "var(--border)"}`,
                      background: (drag && pointerOverHold(drag))
                        ? "color-mix(in oklab,var(--brand) 22%,var(--surface))"
                        : held
                          ? "color-mix(in oklab,var(--brand) 12%,var(--surface))"
                          : "var(--surface)",
                      transition: "border-color 150ms, background 150ms",
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

                    if (!piece) return <div key={idx} style={{ width: 82, height: 82 }} />;

                    const { shape, color } = piece;
                    const maxR = Math.max(...shape.map(([r]) => r));
                    const maxC = Math.max(...shape.map(([, c]) => c));
                    const csz = Math.max(10, Math.min(20, Math.floor(68 / Math.max(maxR + 1, maxC + 1))));
                    const isDragging = drag?.source.kind === "tray" && drag.source.slot === idx;

                    return (
                      <div
                        key={idx}
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => startDrag(e, { kind: "tray", slot: idx }, piece, csz + 2)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 8,
                          borderRadius: 10,
                          border: `2px solid var(--border)`,
                          background: "var(--surface)",
                          cursor: "grab",
                          minWidth: 82,
                          minHeight: 82,
                          touchAction: "none",
                          userSelect: "none",
                          opacity: isDragging ? 0.3 : 1,
                          transition: "opacity 120ms",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: `repeat(${maxC + 1},${csz}px)`,
                            gridTemplateRows: `repeat(${maxR + 1},${csz}px)`,
                            gap: 2,
                            pointerEvents: "none",
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
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-center text-xs mt-3" style={{ color: "var(--text-subtle)" }}>
                Drag a piece onto the board to place · drop on Hold to store for later
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

      {/* Floating dragged-piece ghost (follows the cursor) */}
      {drag && (() => {
        const pitch = CELL + GAP;
        const left = drag.pointer.x - (drag.grabCellC + drag.subX) * pitch;
        const top = drag.pointer.y - (drag.grabCellR + drag.subY) * pitch;
        const { shape, color } = drag.piece;
        return (
          <div
            style={{
              position: "fixed",
              left,
              top,
              pointerEvents: "none",
              zIndex: 50,
              transform: "scale(1.06)",
              transformOrigin: "top left",
              filter:
                "drop-shadow(0 18px 14px rgba(0,0,0,0.35)) drop-shadow(0 6px 8px rgba(0,0,0,0.25))",
            }}
          >
            {shape.map(([dr, dc], i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: dc * pitch,
                  top: dr * pitch,
                  width: CELL,
                  height: CELL,
                  background: `linear-gradient(180deg, color-mix(in oklab,${color} 75%,white), ${color} 55%, color-mix(in oklab,${color} 75%,black))`,
                  borderRadius: 5,
                  boxShadow:
                    "inset 0 2px 0 rgba(255,255,255,0.4), " +
                    "inset 0 -3px 0 rgba(0,0,0,0.35), " +
                    "inset -2px 0 0 rgba(0,0,0,0.2)",
                }}
              />
            ))}
          </div>
        );
      })()}

      {/* Snap-back ghost shown briefly after an invalid drop */}
      {invalidReturn && (() => {
        const pitch = CELL + GAP;
        const { shape, color } = invalidReturn.piece;
        const dx = invalidReturn.to.x - invalidReturn.from.x;
        const dy = invalidReturn.to.y - invalidReturn.from.y;
        return (
          <div
            key={invalidReturn.id}
            style={{
              position: "fixed",
              left: invalidReturn.from.x,
              top: invalidReturn.from.y,
              pointerEvents: "none",
              zIndex: 49,
              animation: "bb-snapback 220ms ease-out forwards",
              ["--bb-dx" as string]: `${dx}px`,
              ["--bb-dy" as string]: `${dy}px`,
            } as React.CSSProperties}
          >
            {shape.map(([dr, dc], i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: dc * pitch,
                  top: dr * pitch,
                  width: CELL,
                  height: CELL,
                  background: color,
                  border: `1px solid ${color}`,
                  borderRadius: 4,
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}
