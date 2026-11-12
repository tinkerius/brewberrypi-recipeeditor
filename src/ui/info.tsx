/**
 * The info fields (EDT-072, QE-75): an ⓘ next to a field or figure opens what belongs to it, instead of showing it
 * beside the field — what it is (its explanation), its typical value or range, and how it is worked out. Only the
 * field's errors and warnings stay visible next to it (EDT-062), and the rests' temperature ranges beside their names.
 */

import type { ComponentChildren } from "preact";

/** The small ⓘ button of a field or figure: shows and hides its info (like the figures', QE-44). */
export function InfoButton(props: { open: boolean; label: string; controls: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-info-button
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

/** What an info field holds, each part only where there is one. */
export interface Info {
  /** What the field is ("From your water supplier's analysis: the starting value."). */
  explanation?: ComponentChildren;
  /** Its typical value or range ("2.5–5 L/kg of malt"). */
  typical?: ComponentChildren;
  /** How it is worked out (a formula, a table). */
  calculation?: ComponentChildren;
}

/** An info field's content, in a fixed order: the explanation, "Typical: …", "Calculation: …". */
export function InfoContent(props: { info: Info }) {
  const { explanation, typical, calculation } = props.info;
  return (
    <div class="space-y-1.5">
      {explanation !== undefined && <p data-info-explanation>{explanation}</p>}
      {typical !== undefined && (
        <div data-info-typical>
          <span class="font-semibold">Typical: </span>
          {typical}
        </div>
      )}
      {calculation !== undefined && (
        <div data-info-calculation>
          <p class="font-semibold">Calculation:</p>
          {calculation}
        </div>
      )}
    </div>
  );
}

/** The panel an ⓘ opens, below its field or figure. */
export const INFO_PANEL = "rounded-md bg-stone-100 p-2 text-xs text-stone-700 dark:bg-white/5 dark:text-stone-300";

/**
 * A computed figure in a `dl` of figures (EDT-072): its term, its value (and what to enter while it can't be worked
 * out), an ⓘ, and below, while open, its info. The `dl` is a two-column grid.
 */
export function FigureRow(props: {
  id: string;
  term: string;
  value: ComponentChildren;
  /** Shown after the value while the figure can't be worked out ("Enter the mash water."). */
  missing?: string;
  info: Info;
  termClass: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panel = `figure-info-${props.id}`;
  return (
    <>
      <dt class={props.termClass}>{props.term}</dt>
      <dd class="flex flex-wrap items-center gap-x-2 gap-y-1">
        {props.value}
        <InfoButton open={props.open} label={`About: ${props.term}`} controls={panel} onClick={props.onToggle} />
        {props.missing && (
          <span class="text-xs text-stone-500 dark:text-stone-400" data-figure-missing={props.id}>
            {props.missing}
          </span>
        )}
      </dd>
      {props.open && (
        <dd id={panel} class={`col-span-2 ${INFO_PANEL}`} data-figure-info={props.id}>
          <InfoContent info={props.info} />
        </dd>
      )}
    </>
  );
}
