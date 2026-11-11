/**
 * Form fields with their typical values (EDT-068, QE-60), laid out like the Mashing tab's rests: each row the field's
 * label, the field with its unit, a **Typical** column (the typical value, amber while the value is outside it, an ⓘ
 * button for how it is worked out, and the field's errors and warnings right after it, EDT-062), then a one-line hint.
 * On a phone the typical value ("Typical: …") and the hint go below the field.
 */

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { FieldNotes, hasWarning, type Note } from "./notes";
import { HINT_STYLE } from "./styles";

// The same column widths in every grid, so the fields, typical values and hints line up across sections and tabs.
const GRID =
  "grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[11rem_10.5rem_15rem_1fr] [&_input]:max-w-full";
const HEAD = "hidden text-xs font-semibold text-stone-600 sm:block dark:text-stone-300";

/** The grid, with its column header "Typical" (EDT-068). */
export function FieldGrid(props: { children: ComponentChildren; [data: `data-${string}`]: unknown }) {
  const { children, ...data } = props;
  return (
    <div class={GRID} {...data}>
      <span class={HEAD} aria-hidden="true" />
      <span class={HEAD} aria-hidden="true" />
      <span class={HEAD}>Typical</span>
      <span class={HEAD} aria-hidden="true" />
      {children}
    </div>
  );
}

/** The ⓘ button that shows and hides how a typical value is worked out (like the figures', QE-44). */
function InfoButton(props: { open: boolean; label: string; controls: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-typical-info
      class={
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-light " +
        (props.open
          ? "bg-ink text-paper ring-ink dark:bg-ink-light dark:text-ink dark:ring-ink-light"
          : "text-stone-600 ring-stone-300 hover:bg-stone-100 dark:text-stone-300 dark:ring-white/20 dark:hover:bg-white/10")
      }
      aria-expanded={props.open}
      aria-controls={props.controls}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      i
    </button>
  );
}

/**
 * One row: `field` is a NumberField or TextField (its label and its input, two cells of the grid); then the typical
 * value with its ⓘ and the field's notes, then the hint; below, while open, how the typical value is worked out.
 */
export function FieldRow(props: {
  /** The row's id, for its `data-field-row` and the ⓘ panel. */
  id: string;
  field: ComponentChildren;
  typical?: ComponentChildren;
  /** The ⓘ's label ("How the mash water is worked out") and what it shows. */
  info?: { label: string; content: ComponentChildren };
  notes: Note[];
  hint: ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const warn = hasWarning(props.notes);
  const aboutId = `typical-about-${props.id}`;
  return (
    <div class="contents" data-field-row={props.id}>
      {props.field}
      <div class="col-start-2 text-[11px] leading-snug sm:col-start-auto sm:text-xs" data-typical-cell>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          {props.typical !== undefined && (
            <span
              data-typical
              class={warn ? "font-medium text-amber-700 dark:text-brass-light" : "text-stone-500 dark:text-stone-400"}
            >
              <span class="sm:hidden">Typical: </span>
              {props.typical}
            </span>
          )}
          {props.info && <InfoButton open={open} label={props.info.label} controls={aboutId} onClick={() => setOpen(!open)} />}
        </div>
        <FieldNotes notes={props.notes} class="mt-0.5" />
      </div>
      <span class={`${HINT_STYLE} col-span-2 mb-2 sm:col-span-1 sm:mb-0`} data-field-hint>
        {props.hint}
      </span>
      {props.info && open && (
        <div
          id={aboutId}
          class="col-span-full mb-2 rounded-md bg-stone-100 p-2 text-xs text-stone-700 dark:bg-white/5 dark:text-stone-300"
          data-typical-about={props.id}
        >
          {props.info.content}
        </div>
      )}
    </div>
  );
}
