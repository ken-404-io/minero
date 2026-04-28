"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCoin, IconTrophy } from "@/components/icons";
import {
  startGameSession,
  finishGameSession,
  getGameBalance,
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

// Must mirror backend GAME_CONFIG.blockblast — used to preview the coin
// total in the nav bar while the game is in progress.
const BB_COINS_PER_SCORE = 0.1;
const BB_MAX_SCORE = 5_000;
const BB_MAX_COINS_SESSION = 500;
function previewCoins(score: number): number {
  return Math.min(Math.floor(Math.min(score, BB_MAX_SCORE) * BB_COINS_PER_SCORE), BB_MAX_COINS_SESSION);
}

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
          <div
            key={j}
            style={{
              width: csz,
              height: csz,
              background: on
                ? `linear-gradient(180deg, color-mix(in oklab,${color} 78%,white), ${color} 55%, color-mix(in oklab,${color} 78%,black))`
                : "transparent",
              borderRadius: on ? 3 : 2,
              boxShadow: on
                ? "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}

let _popId = 0;
type ScorePop = { id: number; pts: number };
type ComboPop = { id: number; label: string; color: string };

// Combo on a chained-clear streak takes priority over the multi-line label;
// on a fresh clear the label reflects how many lines went out at once.
function pickComboLabel(ln: number, newCombo: number): { label: string; color: string } {
  if (newCombo >= 2) return { label: `COMBO ${newCombo}x`, color: "#f97316" };
  if (ln >= 4) return { label: "AMAZING!", color: "#a855f7" };
  if (ln === 3) return { label: "TRIPLE!", color: "#ec4899" };
  if (ln === 2) return { label: "DOUBLE!", color: "#06b6d4" };
  return { label: "GREAT!", color: "#10b981" };
}

export default function BlockBlastClient({ playerName: _ }: { playerName: string }) {
  const sessionIdRef = useRef<string | null>(null);
  // Server-confirmed balance just before this game started — used to emit a
  // live provisional total (baseBalance + currentScore) while playing.
  const baseBalanceRef = useRef<number>(0);

  async function initSession() {
    const [sessionResult, balResult] = await Promise.all([
      startGameSession("blockblast"),
      getGameBalance(),
    ]);
    if (sessionResult.ok) sessionIdRef.current = sessionResult.sessionId;
    baseBalanceRef.current = balResult?.balance ?? 0;
  }
  const [status, setStatus] = useState<Status>("idle");
  const [grid, setGrid] = useState<(string | null)[][]>(emptyGrid);
  const [pieces, setPieces] = useState<[ColoredPiece | null, ColoredPiece | null, ColoredPiece | null]>([null, null, null]);
  const [held, setHeld] = useState<ColoredPiece | null>(null);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [clearingCells, setClearingCells] = useState<Map<string, string>>(new Map());
  const [settleCells, setSettleCells] = useState<Set<string>>(new Set());
  const [scorePops, setScorePops] = useState<ScorePop[]>([]);
  const [comboPops, setComboPops] = useState<ComboPop[]>([]);
  const [combo, setCombo] = useState(0);
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

  const router = useRouter();
  // Game-over flow: status flips to "over" instantly; we run a grayout sweep
  // first, then show the modal, and on Quit we fire an explosion before
  // navigating away.
  const [gameOverShown, setGameOverShown] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [gameInAnim, setGameInAnim] = useState(false);

  useEffect(() => {
    if (status === "over") {
      // Grayout completes after the diagonal sweep + cell duration; then reveal modal.
      const totalGrayoutMs = (G + G) * 40 + 300;
      const t = setTimeout(() => setGameOverShown(true), totalGrayoutMs);
      return () => clearTimeout(t);
    }
    setGameOverShown(false);
    setExploding(false);
  }, [status]);

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
    const loadedStats = loadStats();
    const loadedDaily = loadDailyData();
    setStats(loadedStats);
    setDaily(loadedDaily);

    // Auto-start the game on mount so the player lands directly on the board.
    // Daily plays decrement now (same cost model as the old "Start Game" button).
    if (MAX_DAILY_PLAYS - loadedDaily.plays > 0) {
      const newDaily: DailyData = { date: todayStr(), plays: loadedDaily.plays + 1 };
      setDaily(newDaily);
      saveDailyData(newDaily);
      setPieces(threeNew(0));
      setStatus("playing");
      sessionIdRef.current = null;
      void initSession();
    } else {
      // No plays left today — go straight to the limit-reached banner.
      setStatus("over");
    }
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
    setComboPops([]);
    setCombo(0);
    setStatus("playing");
    sessionIdRef.current = null;
    void initSession();
  }

  function handlePlayAgain() {
    setGameOverShown(false);
    setExploding(false);
    setGameInAnim(true);
    startGame();
    setTimeout(() => setGameInAnim(false), 480);
  }

  function handleQuit() {
    setGameOverShown(false);
    setExploding(true);
    // Let the explosion play, then leave.
    setTimeout(() => router.push("/game"), 700);
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

    // Combo streak — increments while the player keeps clearing on consecutive drops.
    const newCombo = ln > 0 ? combo + 1 : 0;
    const lineBonus = ln >= 4 ? 2 : ln === 3 ? 1.6 : ln === 2 ? 1.3 : 1;
    const comboMult = 1 + Math.min(Math.max(newCombo - 1, 0), 5) * 0.2; // caps at 2x

    // Score decay: points earned shrink as current score approaches SCORE_CAP.
    const mult = scoreMultiplier(score);
    const basePts = piece.shape.length + ln * 10 + Math.max(0, ln - 1) * 5;
    const pts = Math.max(1, Math.round(basePts * mult * lineBonus * comboMult));
    const newScore = score + pts;
    const newLines = lines + ln;

    setCombo(newCombo);
    if (ln > 0) {
      const { label, color } = pickComboLabel(ln, newCombo);
      const cpop: ComboPop = { id: ++_popId, label, color };
      setComboPops((prev) => [...prev, cpop]);
      setTimeout(() => setComboPops((prev) => prev.filter((p) => p.id !== cpop.id)), 1100);
    }

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

    // Emit a provisional live balance (applying the same 0.1× conversion the
    // server uses) so the nav bar updates every drop without resetting at game-over.
    emitBalanceChange(baseBalanceRef.current + previewCoins(newScore));

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
        // finishGameSession emits the server-confirmed balance internally.
        void finishGameSession(sid, newScore);
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
        @keyframes bb-combopop {
          0%   { transform: translate(-50%, 14px)  scale(0.55); opacity: 0; }
          18%  { transform: translate(-50%, 0)     scale(1.25); opacity: 1; }
          38%  { transform: translate(-50%, -6px)  scale(1.05); opacity: 1; }
          85%  { transform: translate(-50%, -52px) scale(1.0);  opacity: 1; }
          100% { transform: translate(-50%, -78px) scale(0.85); opacity: 0; }
        }
        @keyframes bb-grayout {
          0%   { filter: grayscale(0) brightness(1); }
          100% { filter: grayscale(1) brightness(0.55); }
        }
        @keyframes bb-explode {
          0%   { transform: scale(1)    rotate(0deg);   opacity: 1; }
          40%  { transform: scale(1.45) rotate(12deg);  opacity: 1; }
          100% { transform: scale(0.05) rotate(40deg);  opacity: 0; }
        }
        @keyframes bb-modalin {
          0%   { transform: translateY(18px) scale(0.92); opacity: 0; }
          60%  { transform: translateY(-2px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes bb-backdropin {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bb-gamein {
          0%   { transform: scale(0.85); opacity: 0; }
          60%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 14,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "12px 14px",
            borderRadius: 14,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "var(--text-subtle)",
              textTransform: "uppercase",
            }}
          >
            Score
          </span>
          <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.05, color: "var(--text)" }}>
            {score}
          </span>
          {status === "playing" ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: multColor(currentMult),
                marginTop: 4,
              }}
            >
              ×{currentMult.toFixed(2)} coin rate
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4 }}>
              {lines} lines
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "12px 14px",
            borderRadius: 14,
            background: "color-mix(in oklab, var(--brand) 12%, var(--surface-2))",
            border: "1px solid color-mix(in oklab, var(--brand) 38%, var(--border))",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "color-mix(in oklab, var(--brand) 78%, var(--text-subtle))",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <IconTrophy size={11} /> Best
          </span>
          <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.05, color: "var(--brand)" }}>
            {Math.max(stats.bestScore, score)}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4 }}>
            {status === "playing" ? `${lines} lines · combo ${combo}` : `${stats.linesCleared} cleared`}
          </span>
        </div>
      </div>

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
            <div
              style={{
                width: gridWidth + 20,
                margin: "0 auto 20px",
                padding: 10,
                background: "color-mix(in oklab, var(--bg) 65%, var(--surface))",
                borderRadius: 16,
                border: "1px solid var(--border)",
                boxShadow:
                  "0 8px 22px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
                animation: gameInAnim ? "bb-gamein 0.48s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
                transformOrigin: "center",
              }}
            >
            <div style={{ position: "relative", width: gridWidth, margin: "0 auto" }}>
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

                  // Empty cells: dark inset "well" so filled blocks pop above them.
                  let bg: string = "rgba(0,0,0,0.32)";
                  let border = "transparent";
                  let extra: React.CSSProperties = {
                    boxShadow:
                      "inset 0 2px 3px rgba(0,0,0,0.55), " +
                      "inset 0 -1px 0 rgba(255,255,255,0.04)",
                  };
                  let animCss: React.CSSProperties = {};

                  // Stronger 2.5D extrusion for filled / clearing / preview cells.
                  const extrudeShadow =
                    "inset 0 3px 0 rgba(255,255,255,0.42), " +
                    "inset 3px 0 0 rgba(255,255,255,0.10), " +
                    "inset 0 -4px 0 rgba(0,0,0,0.42), " +
                    "inset -3px 0 0 rgba(0,0,0,0.22), " +
                    "0 4px 6px rgba(0,0,0,0.40)";

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

                  // Quit explosion: every filled cell scales out and rotates.
                  if (exploding && cellColor) {
                    animCss = {
                      animation: "bb-explode 0.6s cubic-bezier(0.5,0,0.75,0) forwards",
                      animationDelay: `${((r + c) % 5) * 30}ms`,
                    };
                  } else if (status === "over" && cellColor && clearColor === undefined) {
                    // Game-over grayout sweep — diagonal stagger.
                    animCss = {
                      animation: "bb-grayout 0.42s ease forwards",
                      animationDelay: `${(r + c) * 40}ms`,
                    };
                  }

                  return (
                    <div
                      key={key}
                      style={{
                        width: CELL,
                        height: CELL,
                        background: bg,
                        border: border === "transparent" ? "none" : `1px solid ${border}`,
                        borderRadius: 7,
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

              {/* Combo / streak labels (GREAT, DOUBLE, COMBO Nx, …) */}
              {comboPops.map((pop) => (
                <div
                  key={pop.id}
                  style={{
                    position: "absolute",
                    top: "32%",
                    left: "50%",
                    fontWeight: 900,
                    fontSize: "2.1rem",
                    letterSpacing: "0.06em",
                    color: pop.color,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    textShadow: `0 3px 14px rgba(0,0,0,0.75), 0 0 18px ${pop.color}`,
                    animation: "bb-combopop 1.05s cubic-bezier(0.2,0,0.4,1) forwards",
                    zIndex: 11,
                  }}
                >
                  {pop.label}
                </div>
              ))}

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
                        onPointerDown={(e) => {
                          const gridEl = e.currentTarget.firstElementChild as HTMLElement | null;
                          startDrag(e, { kind: "tray", slot: idx }, piece, csz + 2, gridEl);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 4,
                          minWidth: 82,
                          minHeight: 82,
                          cursor: "grab",
                          touchAction: "none",
                          userSelect: "none",
                          opacity: isDragging ? 0.3 : 1,
                          transform: isDragging ? "scale(0.95)" : "scale(1)",
                          transition: "opacity 120ms, transform 120ms",
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
                              <div
                                key={j}
                                style={{
                                  width: csz,
                                  height: csz,
                                  background: on
                                    ? `linear-gradient(180deg, color-mix(in oklab,${color} 78%,white), ${color} 55%, color-mix(in oklab,${color} 78%,black))`
                                    : "transparent",
                                  borderRadius: on ? 4 : 2,
                                  boxShadow: on
                                    ? "inset 0 1px 0 rgba(255,255,255,0.40), inset 0 -2px 0 rgba(0,0,0,0.32), 0 2px 3px rgba(0,0,0,0.32)"
                                    : "none",
                                }}
                              />
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

      {/* Centered Game Over modal — shown after the grayout sweep finishes. */}
      {gameOverShown && status === "over" && !exploding && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.66)",
            backdropFilter: "blur(2px)",
            zIndex: 100,
            animation: "bb-backdropin 200ms ease forwards",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 340,
              padding: "26px 22px",
              borderRadius: 18,
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              boxShadow: "0 22px 50px rgba(0,0,0,0.55)",
              textAlign: "center",
              animation: "bb-modalin 320ms cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 6 }}>💥</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Game Over!</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "8px 0 0" }}>
              Coins <strong style={{ color: "var(--brand)" }}>{score}</strong> · Best <strong>{stats.bestScore}</strong>
            </p>
            {canPlay ? (
              <p style={{ fontSize: 12, color: "var(--text-subtle)", margin: "8px 0 0" }}>
                {playsLeft} of {MAX_DAILY_PLAYS} plays left today
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "#ef4444",
                  fontWeight: 600,
                  margin: "10px 0 0",
                  animation: "bb-limitblink 1.4s ease-in-out infinite",
                }}
              >
                Daily limit reached — resets in ~{hoursUntilReset()}h
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                className="btn"
                onClick={handleQuit}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--border-strong)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                  minHeight: 46,
                }}
              >
                Quit Game
              </button>
              <button
                type="button"
                onClick={canPlay ? handlePlayAgain : undefined}
                disabled={!canPlay}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: canPlay ? "var(--brand)" : "var(--surface-2)",
                  color: canPlay ? "var(--brand-fg)" : "var(--text-subtle)",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: canPlay ? "pointer" : "not-allowed",
                  opacity: canPlay ? 1 : 0.5,
                  minHeight: 46,
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quit explosion — wide particle burst from every filled cell, then route. */}
      {exploding && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 99,
          }}
        >
          {(() => {
            const board = boardRef.current?.getBoundingClientRect();
            if (!board) return null;
            const pitch = CELL + GAP;
            const dirs: [number, number][] = [
              [60, 0], [-60, 0], [0, 60], [0, -60],
              [42, 42], [-42, 42], [42, -42], [-42, -42],
            ];
            const out: React.ReactNode[] = [];
            for (let r = 0; r < G; r++) {
              for (let c = 0; c < G; c++) {
                const color = grid[r][c];
                if (!color) continue;
                const cx = board.left + c * pitch + CELL / 2;
                const cy = board.top + r * pitch + CELL / 2;
                dirs.forEach(([dx, dy], i) => {
                  out.push(
                    <div
                      key={`ex-${r}-${c}-${i}`}
                      style={{
                        position: "fixed",
                        left: cx - 4,
                        top: cy - 4,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        boxShadow: `0 0 12px 2px ${color}`,
                        animation: "bb-particle 0.7s ease-out forwards",
                        ["--bb-px" as string]: `${dx}px`,
                        ["--bb-py" as string]: `${dy}px`,
                      } as React.CSSProperties}
                    />
                  );
                });
              }
            }
            return out;
          })()}
        </div>
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
