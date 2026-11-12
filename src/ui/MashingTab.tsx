/**
 * The Mashing tab (EDT-030..035, QE-32): the brewer's mashing plan as a table. Every rest of the catalogue is one
 * row, in temperature order: a check box, the rest, and the planned temperature and duration in their own columns,
 * each followed by a "Typical" column with the rest's typical value. The ⓘ button expands what the rest does below
 * its row. A temperature outside the rest's typical range is a warning beside that range, not a problem: the file
 * stays valid.
 */

import type { Warning } from "../warnings";
import { FieldNotes, hasWarning, notesAt } from "./notes";
import { useRef, useState } from "preact/hooks";
import type { Problem } from "../validate";
import {
  MASH_REST_IDS,
  MASH_RESTS,
  mashingOf,
  newMashRest,
  typicalTemperature,
  withMashRest,
  type MashRest,
  type MashRestId,
  type Recipe,
} from "../model";
import { NumberField } from "./fields";
import { MashLadder } from "./MashLadder";
import { ABOUT, CELL, HEAD, InfoToggle, TABLE_FRAME, VALUE } from "./restTable";
import { SECTION_TITLE_STYLE } from "./styles";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


function RestRows(props: {
  id: MashRestId;
  rest: MashRest | undefined;
  problems: Problem[];
  warnings: Warning[];
  open: boolean;
  onToggle: () => void;
  onChange: (rest: MashRest | undefined) => void;
}) {
  const { id, rest } = props;
  const info = MASH_RESTS[id];
  const planned = rest !== undefined;
  const at = `mashing.${id}`;
  const invalid = (field: string) => props.problems.some((p) => p.path === `${at}.${field}`);
  // A field's errors and warnings, next to its typical value (EDT-033, EDT-062).
  const notes = (field: string) => (planned ? notesAt({ problems: props.problems, warnings: props.warnings }, `${at}.${field}`) : []);
  const warn = hasWarning(notes("temperature"));
  const warnMinutes = hasWarning(notes("minutes"));
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
          <div class="pt-1.5 text-[13px] leading-snug sm:text-sm sm:leading-normal">
            <label for={checkbox} class="cursor-pointer font-semibold text-ink dark:text-ink-light">
              {/* On a phone the short name, so the columns fit. */}
              <span class="sm:hidden">{info.short}</span>
              <span class="hidden sm:inline">{info.label}</span>
            </label>{" "}
            {/* The typical temperature range beside the name, grey (amber while outside it; QE-73). */}
            {typical("temperature", `(${typicalTemperature(id)})`, warn)}
            <FieldNotes notes={notes("temperature")} class="mt-0.5" />
          </div>
        </td>
        <td class={`${CELL} w-12 sm:w-20`}>
          {planned && (
            <NumberField
              label={`Temperature (°C), ${info.short}`}
              compact
              unit="°C"
              value={rest.temperature}
              invalid={invalid("temperature")}
              warn={warn}
              describedBy={typicalId("temperature")}
              onChange={(v) => props.onChange({ ...rest, temperature: v })}
            />
          )}
        </td>
        <td class={`${CELL} w-12 sm:w-20`}>
          {planned && (
            <NumberField
              label={`Duration (min), ${info.short}`}
              compact
              unit="min"
              integer
              value={rest.minutes}
              invalid={invalid("minutes")}
              warn={warnMinutes}
              describedBy={typicalId("minutes")}
              onChange={(v) => props.onChange({ ...rest, minutes: v })}
            />
          )}
        </td>
        <td class={CELL}>
          <div class={VALUE}>
            {typical("minutes", info.duration, warnMinutes)}
            <FieldNotes notes={notes("minutes")} />
          </div>
        </td>
        <td class={`${CELL} w-7 text-right sm:w-10`}>
          <InfoToggle open={props.open} controls={about} label={`About the ${info.short}`} title="About this rest" onClick={props.onToggle} />
        </td>
      </tr>
      {props.open && (
        <tr id={about} data-mash-about={id} class={planned ? "bg-berry-light/10 dark:bg-berry-light/5" : ""}>
          <td />
          <td colSpan={5} class={`${CELL} pt-0`}>
            <dl class={ABOUT}>
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

export function MashingTab(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
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
      <section aria-labelledby="mash-ladder-title">
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
        <div class={TABLE_FRAME}>
          <table ref={table} aria-labelledby="mash-rests-title" class="w-full border-collapse">
            <thead class="bg-stone-50 dark:bg-white/5">
              <tr>
                <th class={HEAD}>
                  <span class="sr-only">Planned</span>
                </th>
                <th class={HEAD}>Rest</th>
                <th class={HEAD}>Temperature</th>
                <th class={HEAD}>Duration</th>
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
                    warnings={props.warnings}
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
