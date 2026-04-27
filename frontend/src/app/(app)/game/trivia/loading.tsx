// The launch overlay (mounted by /game/layout.tsx) covers this segment
// while the page suspends. Returning null replaces the parent skeleton with
// a transparent fallback so the new page can fade in cleanly underneath.
export default function Loading() {
  return null;
}
