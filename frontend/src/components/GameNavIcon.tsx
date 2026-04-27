// Animated game button for the bottom nav center slot.
// Self-contained SVG — replaces the generic .mobile-nav-center-btn span.
export default function GameNavIcon({ active }: { active: boolean }) {
  const RAYS   = [0, 45, 90, 135, 180, 225, 270, 315];
  const SPARKS = [15, 58, 100, 143, 186, 229, 272, 315, 36, 79];

  return (
    <span className="game-nav-btn" aria-hidden>
      <svg
        viewBox="0 0 56 56"
        width="56"
        height="56"
        style={{ overflow: "visible" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Soft bloom filter */}
          <filter id="gnav-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gnav-bloom" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Button fill gradients */}
          <radialGradient id="gnav-bg" cx="50%" cy="36%" r="64%">
            <stop offset="0%"   stopColor="#2e1800" />
            <stop offset="100%" stopColor="#0c0800" />
          </radialGradient>
          <radialGradient id="gnav-bg-active" cx="50%" cy="36%" r="64%">
            <stop offset="0%"   stopColor="#3d2400" />
            <stop offset="100%" stopColor="#120d00" />
          </radialGradient>

          {/* Outer aura disc */}
          <radialGradient id="gnav-aura-grad" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor="#f0b429" stopOpacity="0" />
            <stop offset="100%" stopColor="#f0b429" stopOpacity="0.28" />
          </radialGradient>

          {/* Glossy top highlight */}
          <linearGradient id="gnav-gloss" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="white" stopOpacity="0.18" />
            <stop offset="55%"  stopColor="white" stopOpacity="0.03" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Flame streak gradient */}
          <linearGradient id="gnav-flame-r" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#f0b429" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#f0b429" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gnav-flame-l" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%"   stopColor="#f0b429" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#f0b429" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ── Flame / energy streaks ─────────────────────────────── */}
        <rect x="-22" y="26.5" width="20" height="2.5" rx="1.2" fill="url(#gnav-flame-l)" className="gnav-flame gnav-flame-l" />
        <rect x="58"  y="26.5" width="20" height="2.5" rx="1.2" fill="url(#gnav-flame-r)" className="gnav-flame gnav-flame-r" />

        {/* ── Outer aura disc (pulsing) ──────────────────────────── */}
        <circle cx="28" cy="28" r="35" fill="url(#gnav-aura-grad)" className="gnav-aura" />

        {/* ── Pulsing rings ─────────────────────────────────────── */}
        <circle cx="28" cy="28" r="29" fill="none" stroke="#f0b429" strokeWidth="0.7" className="gnav-ring1" />
        <circle cx="28" cy="28" r="33" fill="none" stroke="#f8c63d" strokeWidth="0.35" className="gnav-ring2" />

        {/* ── Energy rays ───────────────────────────────────────── */}
        {RAYS.map((deg, i) => {
          const a = (deg * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={28 + Math.cos(a) * 23} y1={28 + Math.sin(a) * 23}
              x2={28 + Math.cos(a) * 31} y2={28 + Math.sin(a) * 31}
              stroke="#f0b429" strokeWidth="0.8" strokeLinecap="round"
              className={`gnav-ray gnav-ray-${i}`}
            />
          );
        })}

        {/* ── Spark particles ───────────────────────────────────── */}
        {SPARKS.map((deg, i) => {
          const a   = (deg * Math.PI) / 180;
          const dist = 26 + (i % 3) * 4;
          return (
            <circle
              key={i}
              cx={28 + Math.cos(a) * dist}
              cy={28 + Math.sin(a) * dist}
              r={i % 2 === 0 ? 1.0 : 0.65}
              fill="#fbbf24"
              className={`gnav-spark gnav-spark-${i}`}
            />
          );
        })}

        {/* ── Main button circle ────────────────────────────────── */}
        <circle
          cx="28" cy="28" r="24"
          fill={active ? "url(#gnav-bg-active)" : "url(#gnav-bg)"}
          stroke={active ? "#f0b429" : "#3d2c08"}
          strokeWidth={active ? "1.6" : "1"}
          filter={active ? "url(#gnav-glow)" : undefined}
        />
        {/* Subtle inner rim */}
        <circle cx="28" cy="28" r="22.4" fill="none" stroke="rgba(255,200,60,0.06)" strokeWidth="1" />

        {/* Active border bloom */}
        {active && (
          <circle cx="28" cy="28" r="24" fill="none" stroke="#f8c63d" strokeWidth="0.5" opacity="0.45" filter="url(#gnav-bloom)" />
        )}

        {/* ── Game controller ───────────────────────────────────── */}
        <g
          transform="translate(15.5, 20.5)"
          stroke={active ? "#f0b429" : "#c09a50"}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={active ? "url(#gnav-glow)" : undefined}
        >
          <rect x="0" y="0" width="25" height="15" rx="4.5" />
          <line x1="5"  y1="7.5" x2="9"  y2="7.5" />
          <line x1="7"  y1="5.5" x2="7"  y2="9.5" />
          <circle cx="17.5" cy="9"   r="1" fill={active ? "#f0b429" : "#c09a50"} stroke="none" />
          <circle cx="20.5" cy="6.5" r="1" fill={active ? "#f0b429" : "#c09a50"} stroke="none" />
        </g>

        {/* ── Glossy top highlight ──────────────────────────────── */}
        <ellipse cx="28" cy="19" rx="11" ry="5.5" fill="url(#gnav-gloss)" />
      </svg>
    </span>
  );
}
