// Shared store for the games-hub → game-page launch animation.
// The overlay mounted in /game/layout.tsx subscribes to this state, so the
// animation persists across the route change while the new page suspends.

export type LaunchPhase = "fly" | "exit";

export type LaunchState = {
  x: number;
  y: number;
  size: number;
  tx: number;
  ty: number;
  src?: string;
  href: string;
  phase: LaunchPhase;
};

let current: LaunchState | null = null;
let startedAt = 0;
let pendingExit: ReturnType<typeof setTimeout> | null = null;
let safety: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

// Match the CSS keyframe durations so phase transitions don't snap the icon
// from a mid-flight transform to the exit keyframe's start state.
const FLY_DURATION_MS = 280;
const EXIT_DURATION_MS = 320;
// Floor for how long we'll wait for the destination page to mount before
// giving up and clearing the overlay (slow network, aborted nav, etc.).
const SAFETY_TIMEOUT_MS = 8000;

function emit() {
  listeners.forEach((cb) => cb());
}

function clearTimers() {
  if (pendingExit) {
    clearTimeout(pendingExit);
    pendingExit = null;
  }
  if (safety) {
    clearTimeout(safety);
    safety = null;
  }
}

export function getLaunch(): LaunchState | null {
  return current;
}

export function subscribeLaunch(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function startLaunch(input: Omit<LaunchState, "phase">): void {
  clearTimers();
  current = { ...input, phase: "fly" };
  startedAt = Date.now();
  emit();
  safety = setTimeout(() => {
    safety = null;
    if (current && current.href === input.href && current.phase === "fly") {
      clearLaunch();
    }
  }, SAFETY_TIMEOUT_MS);
}

export function completeLaunch(href?: string): void {
  // Lets game pages safely call this on mount even when no launch is in
  // flight (direct navigation, refresh) — it just no-ops.
  if (!current) return;
  if (href && current.href !== href) return;
  if (current.phase === "exit") return;
  if (pendingExit) return;

  if (safety) {
    clearTimeout(safety);
    safety = null;
  }

  const elapsed = Date.now() - startedAt;
  const wait = Math.max(0, FLY_DURATION_MS - elapsed);
  pendingExit = setTimeout(() => {
    pendingExit = null;
    if (!current || current.phase === "exit") return;
    current = { ...current, phase: "exit" };
    emit();
    setTimeout(() => {
      if (current && current.phase === "exit") {
        current = null;
        emit();
      }
    }, EXIT_DURATION_MS);
  }, wait);
}

export function clearLaunch(): void {
  clearTimers();
  if (current === null) return;
  current = null;
  emit();
}
