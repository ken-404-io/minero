"use client";

import { useEffect, useRef } from "react";

const ZONE_ID = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID ?? "";

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (!ZONE_ID || injected.current || !containerRef.current) return;
    injected.current = true;

    const containerId = `monetag-${ZONE_ID}`;
    containerRef.current.id = containerId;

    const script = document.createElement("script");
    script.async = true;
    script.dataset.cfasync = "false";
    script.src = `//pl${ZONE_ID}.profitablegatecpm.com/${ZONE_ID}/invoke.js`;
    containerRef.current.insertAdjacentElement("afterend", script);
  }, []);

  if (!ZONE_ID) return null;

  return (
    <div
      aria-label="Advertisement"
      className="w-full flex justify-center"
      style={{ minHeight: 60, background: "var(--bg-elevated)" }}
    >
      <div ref={containerRef} />
    </div>
  );
}
