/** The drag handle of a reorderable item (EDT-012, EDT-046) and the line that shows where it will be dropped. */

export function DragHandle(props: {
  label: string;
  title: string;
  count: number;
  onDragStart: (event: PointerEvent) => void;
  onMoveKey: (delta: -1 | 1) => void;
}) {
  return (
    <button
      type="button"
      data-drag-handle
      aria-label={props.label}
      title={props.title}
      disabled={props.count < 2}
      class={
        "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-stone-400 " +
        "hover:enabled:bg-stone-100 hover:enabled:text-stone-600 active:cursor-grabbing disabled:cursor-default disabled:opacity-30 " +
        "focus-visible:outline-2 focus-visible:outline-berry-light dark:hover:enabled:bg-white/10 dark:hover:enabled:text-stone-200"
      }
      onPointerDown={(e) => {
        if (e.button === 0 && props.count > 1) {
          props.onDragStart(e);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          props.onMoveKey(e.key === "ArrowUp" ? -1 : 1);
        }
      }}
    >
      <svg viewBox="0 0 12 20" aria-hidden="true" class="h-4 w-3 fill-current">
        <circle cx="3" cy="4" r="1.5" />
        <circle cx="9" cy="4" r="1.5" />
        <circle cx="3" cy="10" r="1.5" />
        <circle cx="9" cy="10" r="1.5" />
        <circle cx="3" cy="16" r="1.5" />
        <circle cx="9" cy="16" r="1.5" />
      </svg>
    </button>
  );
}

/** Above (before) or below (after) the item it is in; the item must be positioned (`relative`). */
export function DropLine(props: { at: "before" | "after" }) {
  return (
    <span
      aria-hidden="true"
      data-drop-line
      class={`absolute right-0 left-0 z-10 h-1 rounded-full bg-berry dark:bg-berry-light ${props.at === "before" ? "-top-0.5" : "-bottom-0.5"}`}
    />
  );
}
