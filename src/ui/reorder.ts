/** Reordering a list by drag and drop (EDT-012): where a dragged item lands, and moving it there. */

/**
 * The slot the pointer is over: 0 = before the first item, n = after the last. midpoints are the vertical centres
 * of the items, top to bottom.
 */
export function dropSlot(pointerY: number, midpoints: number[]): number {
  const slot = midpoints.findIndex((mid) => pointerY < mid);
  return slot === -1 ? midpoints.length : slot;
}

/** The index the item at from ends up at when dropped into slot (its own slot and the next one leave it in place). */
export function targetIndex(from: number, slot: number): number {
  return slot > from ? slot - 1 : slot;
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
