"use client";

import { useSyncExternalStore } from "react";
import { getLaunch, subscribeLaunch, type LaunchState } from "@/lib/game-launch";

const getServer = (): LaunchState | null => null;

export default function GameLaunchOverlay() {
  const state = useSyncExternalStore(subscribeLaunch, getLaunch, getServer);

  if (!state) return null;

  const style = {
    "--gl-x": `${state.x}px`,
    "--gl-y": `${state.y}px`,
    "--gl-size": `${state.size}px`,
    "--gl-tx": `${state.tx}px`,
    "--gl-ty": `${state.ty}px`,
  } as React.CSSProperties;

  return (
    <div
      className="game-launch-overlay"
      data-phase={state.phase}
      aria-hidden
      role="presentation"
    >
      <span className="game-launch-icon" data-phase={state.phase} style={style}>
        {state.src ? <img src={state.src} alt="" /> : null}
      </span>
    </div>
  );
}
