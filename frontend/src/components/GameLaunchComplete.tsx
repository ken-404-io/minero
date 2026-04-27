"use client";

import { useEffect } from "react";
import { completeLaunch } from "@/lib/game-launch";

// Mounted by each game page. When the new page renders (after the server
// component awaits /auth/me), this signals the launch overlay to play the
// exit animation. If no launch is in flight, completeLaunch is a no-op.
export default function GameLaunchComplete({ href }: { href: string }) {
  useEffect(() => {
    completeLaunch(href);
  }, [href]);
  return null;
}
