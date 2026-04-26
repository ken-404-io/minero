import { useCallback, useEffect, useRef, useState } from "react";
import type { ColoredPiece } from "./pieces";

export type DragSource = { kind: "tray"; slot: 0 | 1 | 2 } | { kind: "held" };

export type DragState = {
  source: DragSource;
  piece: ColoredPiece;
  pointer: { x: number; y: number };
  /** Which cell of the piece the user grabbed (top-left of piece is 0,0). */
  grabCellR: number;
  grabCellC: number;
  /** Sub-cell offset 0..1 within the grabbed cell. */
  subX: number;
  subY: number;
  /** Origin viewport coordinate of the source tile, for return-to-tray animation. */
  startRect: { x: number; y: number };
  /** Pointer id that owns this drag, for setPointerCapture reasoning. */
  pointerId: number;
};

export function useDrag(onDrop: (state: DragState) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const active = drag !== null;

  useEffect(() => {
    if (!active) return;

    const onMove = (e: PointerEvent) => {
      // Block touch scrolling while dragging.
      if (e.cancelable) e.preventDefault();
      setDrag((d) => (d ? { ...d, pointer: { x: e.clientX, y: e.clientY } } : d));
    };
    const onUp = (e: PointerEvent) => {
      const final = dragRef.current;
      if (final) {
        onDropRef.current({ ...final, pointer: { x: e.clientX, y: e.clientY } });
      }
      setDrag(null);
    };
    const onCancel = () => setDrag(null);

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [active]);

  const startDrag = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      source: DragSource,
      piece: ColoredPiece,
      srcCellPitch: number,
    ) => {
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const tx = e.clientX - rect.left;
      const ty = e.clientY - rect.top;
      const grabCellC = Math.max(0, Math.floor(tx / srcCellPitch));
      const grabCellR = Math.max(0, Math.floor(ty / srcCellPitch));
      const subX = Math.max(0, Math.min(1, (tx - grabCellC * srcCellPitch) / srcCellPitch));
      const subY = Math.max(0, Math.min(1, (ty - grabCellR * srcCellPitch) / srcCellPitch));

      // setPointerCapture isn't strictly necessary because we listen on window,
      // but it stops the browser from mis-routing the events on flaky touch devices.
      try {
        target.setPointerCapture(e.pointerId);
      } catch {}

      setDrag({
        source,
        piece,
        pointer: { x: e.clientX, y: e.clientY },
        grabCellR,
        grabCellC,
        subX,
        subY,
        startRect: { x: rect.left, y: rect.top },
        pointerId: e.pointerId,
      });
    },
    [],
  );

  return { drag, startDrag };
}
