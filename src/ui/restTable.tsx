/**
 * The look of the Mashing tab's Rests table (EDT-031), shared with the Water treatment table (EDT-069, QE-64), which
 * follows it: the frame, the cells and heads, the planned rows' highlight, and the ⓘ that opens a row's explanation.
 */

/** The frame: full card width on a phone, a rounded framed box from `sm` on; it scrolls sideways inside itself. */
export const TABLE_FRAME =
  "relative -mx-4 overflow-x-auto border-y border-line sm:mx-0 sm:rounded-lg sm:border-0 sm:ring-1 sm:ring-line dark:border-white/10 dark:sm:ring-white/10";
export const CELL = "px-0.5 py-2 align-top first:pl-1.5 last:pr-1 sm:px-2 sm:first:pl-3 sm:last:pr-3";
export const HEAD = `${CELL} text-left text-[11px] font-semibold sm:text-xs text-stone-600 dark:text-stone-300`;
/** A typical value (and its notes), centred on the height of the field beside it. */
export const VALUE = "flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 sm:min-h-9";
/** A row's line above it, and the highlight of a planned (ticked) row. */
export const ROW = "border-t border-line first:border-t-0 dark:border-white/10";
export const PLANNED = "bg-berry-light/10 dark:bg-berry-light/5";
/** A row's name, bold. */
export const NAME = "text-[13px] leading-snug font-semibold sm:text-sm sm:leading-normal text-ink dark:text-ink-light";
/** A row's checkbox. */
export const CHECKBOX = "mt-2 size-4 accent-berry";
/** The panel of a row's explanation, in the row below it. */
export const ABOUT = "space-y-1 rounded-md bg-stone-50 p-3 text-xs text-stone-700 dark:bg-white/5 dark:text-stone-300";

/** The ⓘ toggle of a row (EDT-031): shows and hides its explanation below it. */
export function InfoToggle(props: { open: boolean; controls: string; label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      class={
        "mt-1 inline-flex size-6 items-center sm:size-7 justify-center rounded-full text-sm font-semibold ring-1 ring-inset " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-light " +
        (props.open
          ? "bg-ink text-paper ring-ink dark:bg-ink-light dark:text-ink dark:ring-ink-light"
          : "text-stone-600 ring-stone-300 hover:bg-stone-100 dark:text-stone-300 dark:ring-white/20 dark:hover:bg-white/10")
      }
      aria-expanded={props.open}
      aria-controls={props.controls}
      aria-label={props.label}
      title={props.title}
      onClick={props.onClick}
    >
      i
    </button>
  );
}
