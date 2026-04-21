"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  IconGift,
  IconSparkles,
  IconClock,
  IconTrophy,
  IconCheck,
} from "@/components/icons";

/* ============================================================
   Wheel config
   ============================================================ */

// Ordered clockwise starting from the top wedge (index 0).
const PRIZES: number[] = [10, 50, 5, 100, 25, 10, 250, 25];
const WEDGE_COUNT = PRIZES.length;
const WEDGE_DEG = 360 / WEDGE_COUNT;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SPIN_DURATION_MS = 4500;

// Visual palette that alternates for contrast.
const WEDGE_FILLS = [
  "var(--brand)",
  "var(--surface-3)",
  "var(--brand-hover)",
  "var(--surface-2)",
  "var(--brand)",
  "var(--surface-3)",
  "var(--brand-hover)",
  "var(--surface-2)",
];

const WEDGE_TEXT_FILLS = [
  "var(--brand-fg)",
  "var(--text)",
  "var(--brand-fg)",
  "var(--text)",
  "var(--brand-fg)",
  "var(--text)",
  "var(--brand-fg)",
  "var(--text)",
];

/* ============================================================
   Persisted stats (localStorage + useSyncExternalStore)
   ============================================================ */

type SpinStats = {
  lastSpinAt: number; // epoch ms, 0 if never
  lastPrize: number;
  totalPoints: number;
  spinsCompleted: number;
};

const EMPTY_STATS: SpinStats = {
  lastSpinAt: 0,
  lastPrize: 0,
  totalPoints: 0,
  spinsCompleted: 0,
};

const STORAGE_KEY = "minero_spin_stats_v1";

function parseStats(raw: string | null): SpinStats {
  if (!raw) return EMPTY_STATS;
  try {
    const parsed = JSON.parse(raw) as Partial<SpinStats>;
    return {
      lastSpinAt: Number(parsed.lastSpinAt) || 0,
      lastPrize: Number(parsed.lastPrize) || 0,
      totalPoints: Number(parsed.totalPoints) || 0,
      spinsCompleted: Number(parsed.spinsCompleted) || 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

let cachedRaw: string | null = null;
let cachedStats: SpinStats = EMPTY_STATS;

function getSnapshot(): SpinStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = parseStats(raw);
  }
  return cachedStats;
}

function getServerSnapshot(): SpinStats {
  return EMPTY_STATS;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStats(next: SpinStats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
    cachedStats = parseStats(cachedRaw);
    listeners.forEach((cb) => cb());
  } catch {
    /* quota / private mode */
  }
}

/* ============================================================
   Geometry helpers
   ============================================================ */

// Convert an angle measured clockwise from the top (12 o'clock) into an (x, y)
// point on a circle centered at (cx, cy) with the given radius.
function pointOnCircle(
  cx: number,
  cy: number,
  r: number,
  degFromTop: number,
) {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Ready";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* ============================================================
   Main client
   ============================================================ */

export default function SpinClient({ playerName }: { playerName: string }) {
  const stats = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [now, setNow] = useState<number>(() => Date.now());
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [suppressTransition, setSuppressTransition] = useState(false);
  const [lastResult, setLastResult] = useState<{
    prize: number;
    wedge: number;
  } | null>(null);

  const wheelRef = useRef<SVGGElement | null>(null);
  const pendingWedge = useRef<number | null>(null);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tick clock so countdown updates live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextSpinAt = stats.lastSpinAt ? stats.lastSpinAt + COOLDOWN_MS : 0;
  const cooldownMs = Math.max(0, nextSpinAt - now);
  const cooldownActive = cooldownMs > 0;
  const ready = !cooldownActive && !spinning;

  const firstName = playerName?.split(/\s+/)[0] || "Miner";

  const landPrize = useCallback(
    (wedge: number) => {
      const prev = getSnapshot();
      const prize = PRIZES[wedge];
      writeStats({
        lastSpinAt: Date.now(),
        lastPrize: prize,
        totalPoints: prev.totalPoints + prize,
        spinsCompleted: prev.spinsCompleted + 1,
      });
      setLastResult({ prize, wedge });
      setSpinning(false);

      // Normalize rotation to avoid unbounded growth.
      setSuppressTransition(true);
      setRotation((r) => ((r % 360) + 360) % 360);
      // Re-enable transition on next frame.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSuppressTransition(false));
      });
    },
    [],
  );

  const spin = useCallback(() => {
    if (spinning || cooldownActive) return;
    const wedge = Math.floor(Math.random() * WEDGE_COUNT);
    pendingWedge.current = wedge;

    // The pointer sits at the top (0°). Wedge k is centered at k*WEDGE_DEG
    // (clockwise from top) before any rotation. After rotating the wheel by R
    // degrees clockwise, that wedge is at (k*WEDGE_DEG + R) mod 360. To land
    // wedge k under the pointer we want that to equal 0, i.e. R ≡ -k*WEDGE_DEG.
    // Add a small jitter so the pointer doesn't always hit the exact center.
    const jitter = Math.random() * (WEDGE_DEG - 12) - (WEDGE_DEG - 12) / 2;
    const targetMod =
      ((-wedge * WEDGE_DEG + jitter) % 360 + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = ((targetMod - currentMod) + 360) % 360;
    const nextRotation = rotation + 360 * 5 + delta;

    setLastResult(null);
    setSpinning(true);
    setRotation(nextRotation);

    // Fallback timer in case transitionend doesn't fire (e.g. reduced motion).
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    transitionTimeout.current = setTimeout(() => {
      if (pendingWedge.current !== null) {
        landPrize(pendingWedge.current);
        pendingWedge.current = null;
      }
    }, SPIN_DURATION_MS + 250);
  }, [cooldownActive, landPrize, rotation, spinning]);

  const handleTransitionEnd = useCallback(() => {
    if (!spinning || pendingWedge.current === null) return;
    if (transitionTimeout.current) {
      clearTimeout(transitionTimeout.current);
      transitionTimeout.current = null;
    }
    const wedge = pendingWedge.current;
    pendingWedge.current = null;
    landPrize(wedge);
  }, [landPrize, spinning]);

  useEffect(
    () => () => {
      if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    },
    [],
  );

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 lg:mb-8">
        <span className="section-title">Play</span>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">
          Daily Spin
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          One free spin every 24 hours. Win up to {Math.max(...PRIZES)} game
          points per spin.
        </p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="kpi">
          <span className="kpi-label">Last win</span>
          <span className="kpi-value kpi-value-brand">
            {stats.lastPrize > 0 ? `+${stats.lastPrize}` : "—"}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Total points</span>
          <span className="kpi-value">{stats.totalPoints}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Spins completed</span>
          <span className="kpi-value">{stats.spinsCompleted}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Next spin in</span>
          <span
            className="kpi-value"
            style={{
              fontFamily: "var(--font-mono), ui-monospace, Menlo, monospace",
              color: ready ? "var(--success-fg)" : "var(--text)",
              fontSize: "var(--fs-20)",
            }}
          >
            {formatCountdown(cooldownMs)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        {/* Wheel */}
        <section
          className="card flex flex-col items-center gap-5"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--brand-weak) 45%, transparent), var(--surface))",
          }}
        >
          <WheelSvg
            rotation={rotation}
            spinning={spinning}
            suppressTransition={suppressTransition}
            wheelRef={wheelRef}
            onTransitionEnd={handleTransitionEnd}
          />

          {/* Result / CTA */}
          <div className="w-full max-w-[360px] flex flex-col items-center gap-3">
            {lastResult && !spinning ? (
              <div
                role="status"
                className="alert alert-success w-full text-center"
              >
                <IconCheck size={16} />
                <span>
                  You won{" "}
                  <strong style={{ color: "var(--success-fg)" }}>
                    +{lastResult.prize}
                  </strong>{" "}
                  game points, {firstName}!
                </span>
              </div>
            ) : cooldownActive ? (
              <div role="status" className="alert alert-info w-full text-center">
                <IconClock size={16} />
                <span>
                  Come back in{" "}
                  <strong
                    style={{
                      fontFamily:
                        "var(--font-mono), ui-monospace, Menlo, monospace",
                    }}
                  >
                    {formatCountdown(cooldownMs)}
                  </strong>
                </span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={spin}
              disabled={!ready}
              className="btn btn-primary btn-lg w-full"
              aria-label={
                cooldownActive
                  ? "Spin is on cooldown"
                  : spinning
                    ? "Spinning"
                    : "Spin the wheel"
              }
            >
              <IconSparkles size={18} />
              {spinning
                ? "Spinning…"
                : cooldownActive
                  ? "On cooldown"
                  : "Spin the wheel"}
            </button>
          </div>
        </section>

        {/* Side panel: prizes + rules */}
        <aside className="flex flex-col gap-4">
          <section className="card">
            <div className="flex items-center gap-2 mb-3">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
              >
                <IconGift size={16} />
              </span>
              <span className="section-title">Prize table</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {PRIZES.map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md"
                  style={{
                    background:
                      lastResult?.wedge === i
                        ? "var(--brand-weak)"
                        : "transparent",
                  }}
                >
                  <span
                    className="flex items-center gap-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: WEDGE_FILLS[i] }}
                    />
                    Slot {i + 1}
                  </span>
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color:
                        p === Math.max(...PRIZES)
                          ? "var(--brand)"
                          : "var(--text)",
                    }}
                  >
                    +{p}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="flex items-center gap-2 mb-3">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                style={{ background: "var(--brand-weak)", color: "var(--brand)" }}
              >
                <IconTrophy size={16} />
              </span>
              <span className="section-title">How it works</span>
            </div>
            <ol className="flex flex-col gap-2.5 text-sm">
              {[
                "One spin every 24 hours — the cooldown starts the moment the wheel stops.",
                "The pointer at the top decides your prize.",
                "Game points are tracked on this device.",
                "Come back daily to stack up points.",
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
                    style={{
                      background: "var(--brand-weak)",
                      color: "var(--brand-weak-fg)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Wheel SVG
   ============================================================ */

function WheelSvg({
  rotation,
  spinning,
  suppressTransition,
  wheelRef,
  onTransitionEnd,
}: {
  rotation: number;
  spinning: boolean;
  suppressTransition: boolean;
  wheelRef: React.RefObject<SVGGElement | null>;
  onTransitionEnd: () => void;
}) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;

  const wedges = useMemo(() => {
    return PRIZES.map((prize, i) => {
      const startDeg = i * WEDGE_DEG - WEDGE_DEG / 2;
      const endDeg = i * WEDGE_DEG + WEDGE_DEG / 2;
      const p1 = pointOnCircle(cx, cy, r, startDeg);
      const p2 = pointOnCircle(cx, cy, r, endDeg);
      const labelPt = pointOnCircle(cx, cy, r * 0.62, i * WEDGE_DEG);

      const largeArc = WEDGE_DEG > 180 ? 1 : 0;
      const d = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
      return {
        index: i,
        d,
        labelX: labelPt.x,
        labelY: labelPt.y,
        centerDeg: i * WEDGE_DEG,
        prize,
      };
    });
  }, [cx, cy, r]);

  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.35))",
      }}
    >
      {/* Pointer */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 z-10"
        style={{ top: -4 }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <path
            d="M14 26 L2 6 L26 6 Z"
            fill="var(--brand)"
            stroke="var(--brand-fg)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 4}
          fill="var(--surface)"
          stroke="var(--border-strong)"
          strokeWidth="2"
        />

        <g
          ref={wheelRef}
          onTransitionEnd={onTransitionEnd}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: suppressTransition
              ? "none"
              : spinning
                ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                : "transform 300ms var(--ease-out)",
          }}
        >
          {wedges.map((w) => (
            <g key={w.index}>
              <path
                d={w.d}
                fill={WEDGE_FILLS[w.index]}
                stroke="var(--bg-elevated)"
                strokeWidth="2"
              />
              <text
                x={w.labelX}
                y={w.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight={700}
                fontSize={w.prize >= 100 ? 20 : 18}
                fill={WEDGE_TEXT_FILLS[w.index]}
                transform={`rotate(${w.centerDeg}, ${w.labelX}, ${w.labelY})`}
                style={{ fontFamily: "var(--font-mono), ui-monospace, monospace" }}
              >
                +{w.prize}
              </text>
            </g>
          ))}
        </g>

        {/* Hub */}
        <circle
          cx={cx}
          cy={cy}
          r={22}
          fill="var(--bg-elevated)"
          stroke="var(--border-strong)"
          strokeWidth="2"
        />
        <circle cx={cx} cy={cy} r={8} fill="var(--brand)" />
      </svg>
    </div>
  );
}
