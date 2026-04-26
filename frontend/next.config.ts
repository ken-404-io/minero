import type { NextConfig } from "next";
import path from "node:path";

// Pin Turbopack's workspace root to this app's directory. Without this, Next.js
// walks up to the parent directory looking for a lockfile and picks up the
// repository root (which has no package.json in the split-app layout), which
// causes "Next.js inferred your workspace root, but it may not be correct".
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — this page must never be embedded in an iframe.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stop browsers from MIME-sniffing the response type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full URL in Referer headers to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Deny unnecessary browser features.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS: once loaded over HTTPS, always use HTTPS (prod only).
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
          // Content Security Policy.
          // 'unsafe-inline' is needed for Next.js inline scripts and CSS-in-JS.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // Allow XHR/fetch to the API — uses the configured API URL.
              `connect-src 'self' ${apiUrl} https:`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
