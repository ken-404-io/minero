import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Minero — Earn real pesos every 10 minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#111114",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#3a2a05",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Pickaxe icon — inline SVG path */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 21l7-7M14.5 9.5l-5 5M17 3l-4 4 4 4 4-4-4-4zM7 17l-4 4"
                stroke="#f0b429"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#ededef", letterSpacing: "-0.5px" }}>
            Minero
          </span>
        </div>

        {/* Centre: headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#ededef", lineHeight: 1.05, letterSpacing: "-1.5px" }}>
            Earn real pesos,
            <br />
            <span style={{ color: "#f0b429" }}>every 10 minutes.</span>
          </div>
          <div style={{ fontSize: 24, color: "#a0a0a8", maxWidth: 680, lineHeight: 1.5 }}>
            Watch short ads, claim micro-rewards, and invite friends for a 10% commission — forever.
          </div>
        </div>

        {/* Bottom: trust badges */}
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {["Free to start", "₱300 min. payout", "GCash & Maya", "10% referral"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#1a1a1e",
                border: "1px solid #2a2a30",
                borderRadius: 8,
                padding: "10px 18px",
                fontSize: 18,
                color: "#ededef",
              }}
            >
              <span style={{ color: "#f0b429", fontSize: 16 }}>✓</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
