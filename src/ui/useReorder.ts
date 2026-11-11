/**
 * Reordering a list's items by drag and drop with a handle, or with the arrow keys on the focused handle (EDT-012,
 * EDT-046): the goals of the mash process and the malt and hop tables. Pointer events, so mouse, pen and touch all
 * work. The container's first `count` children are the items (a table may have more rows after them); a row of an
 * item's notes (`data-row-note`, EDT-062) belongs to the item before it and is not counted.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { dropSlot, targetIndex } from "./reorder";

export function useReorder<E extends HTMLElement>(count: number, onMove: (from: number, to: number) => void) {
  const container = useRef<E>(null);
  const [drag, setDrag] = useState<{ from: number; slot: number }>();
  const [focusHandle, setFocusHandle] = useState<number>();
  const items = () => [...(container.current?.children ?? [])].filter((el) => !el.hasAttribute("data-row-note")).slice(0, count);

  // Keyboard reordering: the moved item's handle keeps the focus.
  useEffect(() => {
    if (focusHandle !== undefined) {
      items()[focusHandle]?.querySelector<HTMLButtonElement>("[data-drag-handle]")?.focus();
      setFocusHandle(undefined);
    }
  }, [focusHandle]);

  const startDrag = (from: number, event: PointerEvent) => {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture?.(event.pointerId);
    const midpoints = () =>
      items().map((item) => {
        const r = item.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    setDrag({ from, slot: from });
    const move = (e: PointerEvent) => {
      if (e.clientY < 60) {
        window.scrollBy(0, -16);
      } else if (e.clientY > window.innerHeight - 60) {
        window.scrollBy(0, 16);
      }
      setDrag({ from, slot: dropSlot(e.clientY, midpoints()) });
    };
    const finish = (e: PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      setDrag(undefined);
      if (e.type === "pointerup") {
        const to = targetIndex(from, dropSlot(e.clientY, midpoints()));
        if (to !== from) {
          onMove(from, to);
        }
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  };

  /** Where the drop line goes: none while the item would stay where it is. */
  const dropLine = (i: number): "before" | "after" | undefined => {
    if (!drag || targetIndex(drag.from, drag.slot) === drag.from) {
      return undefined;
    }
    if (drag.slot === i) {
      return "before";
    }
    return drag.slot === count && i === count - 1 ? "after" : undefined;
  };

  /** The arrow keys on item i's handle: one step up or down, the handle keeps the focus. */
  const moveKey = (i: number, delta: -1 | 1) => {
    const to = i + delta;
    if (to >= 0 && to < count) {
      onMove(i, to);
      setFocusHandle(to);
    }
  };

  return { container, startDrag, dropLine, moveKey, dragging: (i: number) => drag?.from === i };
}
