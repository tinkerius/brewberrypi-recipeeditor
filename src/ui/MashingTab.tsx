/**
 * The Mashing tab (EDT-030..035, QE-32): the brewer's mashing plan as a table. Every rest of the catalogue is one
 * row, in temperature order: a check box, the rest, and the planned temperature and duration in their own columns,
 * each followed by a "Typical" column with the rest's typical value. The ⓘ button expands what the rest does below
 * its row. A temperature outside the rest's typical range is a warning beside that range, not a problem: the file
 * stays valid.
 */

import { useRef, useState } from "preact/hooks";
import type { Problem } from "../validate";
import {
  MASH_REST_IDS,
  MASH_RESTS,
  mashingOf,
  newMashRest,
  outsideTypicalRange,
  typicalTemperature,
  withMashRest,
  type MashRest,
  type MashRestId,
  type Recipe,
} from "../model";
import { NumberField } from "./fields";
import { MashLadder } from "./MashLadder";
import { HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const CELL = "px-0.5 py-2 align-top first:pl-1.5 last:pr-1 sm:px-2 sm:first:pl-3 sm:last:pr-3";
const HEAD = `${CELL} text-left text-[11px] font-semibold sm:text-xs text-stone-600 dark:text-stone-300`;
/** A typical value (and its warning), centred on the height of the field beside it. */
const VALUE = "flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 sm:min-h-9";

function RestRows(props: {
  id: MashRestId;
  rest: MashRest | undefined;
  problems: Problem[];
  open: boolean;
  onToggle: () => void;
  onChange: (rest: MashRest | undefined) => void;
}) {
  const { id, rest } = props;
  const info = MASH_RESTS[id];
  const planned = rest !== undefined;
  const at = `mashing.${id}`;
  const invalid = (field: string) => props.problems.some((p) => p.path === `${at}.${field}`);
  const warn = planned && outsideTypicalRange(id, rest.temperature);
  const checkbox = `mash-${id}`;
  const about = `mash-about-${id}`;
  const typicalId = (field: string) => `mash-typical-${id}-${field}`;
  /** A field's typical value, in its own "Typical" column right after the field's, so they line up. */
  const typical = (field: string, text: string, highlight = false) => (
    <span
      id={typicalId(field)}
      data-mash-typical={field}
      class={
        "text-[11px] leading-snug sm:text-xs " +
        (field === "temperature" ? "whitespace-nowrap tracking-tight sm:tracking-normal " : "") +
        (highlight ? "font-medium text-amber-700 dark:text-brass-light" : "text-stone-500 dark:text-stone-400")
      }
    >
      {text}
    </span>
  );
  return (
    <>
      <tr
        data-mash-rest={id}
        class={
          "border-t border-line first:border-t-0 dark:border-white/10 " +
          (planned ? "bg-berry-light/10 dark:bg-berry-light/5" : "")
        }
      >
        <td class={`${CELL} w-5 sm:w-8`}>
          <input
            id={checkbox}
            type="checkbox"
            class="mt-2 size-4 accent-berry"
            checked={planned}
            onChange={(e) => props.onChange(e.currentTarget.checked ? newMashRest(id) : undefined)}
          />
        </td>
        <td class={CELL}>
          <label for={checkbox} class="block cursor-pointer pt-1.5 text-[13px] leading-snug font-semibold sm:text-sm sm:leading-normal text-ink dark:text-ink-light">
            {/* On a phone the short name, so the seven columns fit. */}
            <span class="sm:hidden">{info.short}</span>
            <span class="hidden sm:inline">{info.label}</span>
          </label>
        </td>
        <td class={`${CELL} w-12 sm:w-20`}>
          {planned && (
            <NumberField
              label={`Temperature (°C), ${info.short}`}
              compact
              value={rest.temperature}
              invalid={invalid("temperature")}
              warn={warn}
              describedBy={typicalId("temperature")}
              onChange={(v) => props.onChange({ ...rest, temperature: v })}
            />
          )}
        </td>
        <td class={CELL}>
          <div class={VALUE}>
            {typical("temperature", typicalTemperature(id), warn)}
            {warn && (
              <span class="text-[11px] leading-snug font-medium text-amber-700 sm:text-xs dark:text-brass-light" data-mash-warning>
                ⚠ Outside the typical range
              </span>
            )}
          </div>
        </td>
        <td class={`${CELL} w-12 sm:w-20`}>
          {planned && (
            <NumberField
              label={`Duration (min), ${info.short}`}
              compact
              integer
              value={rest.minutes}
              invalid={invalid("minutes")}
              describedBy={typicalId("minutes")}
              onChange={(v) => props.onChange({ ...rest, minutes: v })}
            />
          )}
        </td>
        <td class={CELL}>
          <div class={VALUE}>{typical("minutes", info.duration)}</div>
        </td>
        <td class={`${CELL} w-7 text-right sm:w-10`}>
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
            aria-controls={about}
            aria-label={`About the ${info.short}`}
            title="About this rest"
            onClick={props.onToggle}
          >
            i
          </button>
        </td>
      </tr>
      {props.open && (
        <tr id={about} data-mash-about={id} class={planned ? "bg-berry-light/10 dark:bg-berry-light/5" : ""}>
          <td />
          <td colSpan={6} class={`${CELL} pt-0`}>
            <dl class="space-y-1 rounded-md bg-stone-50 p-3 text-xs text-stone-700 dark:bg-white/5 dark:text-stone-300">
              {info.about.map(([term, text]) => (
                <div key={term}>
                  <dt class="inline font-semibold">{term}:</dt> <dd class="inline">{text}</dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}

export function MashingTab(props: { recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const plan = mashingOf(props.recipe);
  const [open, setOpen] = useState<MashRestId>();
  const table = useRef<HTMLTableElement>(null);
  /** From the ladder: the rest's details open in the table, and its row comes into view (EDT-037). */
  const showRest = (id: MashRestId) => {
    setOpen(id);
    table.current?.querySelector(`[data-mash-rest=${id}]`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  return (
    <>
      <p class={HINT_STYLE}>
        Tick the rests of your mash and set their temperature and duration. The plan is kept in the recipe file; it
        doesn't change the goals of the mash process.
      </p>
      <section class="mt-4" aria-labelledby="mash-ladder-title">
        <h3 id="mash-ladder-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
          Temperature Ladder
        </h3>
        <MashLadder plan={plan} selected={open} onSelect={showRest} />
      </section>
      <section class="mt-6" aria-labelledby="mash-rests-title">
        <h3 id="mash-rests-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
          Rests
        </h3>
        {/* On a phone the table uses the card's full width; `relative` keeps the fields' screen-reader labels in it. */}
        <div class="relative -mx-4 overflow-x-auto border-y border-line sm:mx-0 sm:rounded-lg sm:border-0 sm:ring-1 sm:ring-line dark:border-white/10 dark:sm:ring-white/10">
          <table ref={table} aria-labelledby="mash-rests-title" class="w-full border-collapse">
            <thead class="bg-stone-50 dark:bg-white/5">
              <tr>
                <th class={HEAD}>
                  <span class="sr-only">Planned</span>
                </th>
                <th class={HEAD}>Rest</th>
                <th class={HEAD}>°C</th>
                <th class={HEAD}>Typical</th>
                <th class={HEAD}>min</th>
                <th class={HEAD}>Typical</th>
                <th class={HEAD}>
                  <span class="sr-only">About</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {MASH_REST_IDS.map((id) => {
                const rest = plan[id];
                return (
                  <RestRows
                    key={id}
                    id={id}
                    rest={rest === undefined ? undefined : isObject(rest) ? (rest as MashRest) : {}}
                    problems={props.problems}
                    open={open === id}
                    onToggle={() => setOpen(open === id ? undefined : id)}
                    onChange={(next) => props.onChange(withMashRest(props.recipe, id, next))}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
