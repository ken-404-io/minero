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
};

export default nextConfig;
