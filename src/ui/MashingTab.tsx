/**
 * The Mashing tab (EDT-030..035, QE-32): the brewer's mashing plan as a table. First the mash-in (QE-77): no check
 * box, always planned, only a temperature. Then every rest of the catalogue is one row, in temperature order: a check box, the rest, and the planned temperature and duration in their own columns,
 * each followed by a "Typical" column with the rest's typical value. The ⓘ button expands what the rest does below
 * its row. A temperature outside the rest's typical range is a warning beside that range, not a problem: the file
 * stays valid.
 */

import type { Warning } from "../warnings";
import { FieldNotes, hasWarning, notesAt } from "./notes";
import { useRef, useState } from "preact/hooks";
import type { Problem } from "../validate";
import {
  MASH_IN,
  MASH_IN_INFO,
  MASH_REST_IDS,
  MASH_RESTS,
  mashingOf,
  newMashRest,
  typicalTemperature,
  withMashIn,
  withMashRest,
  type MashRest,
  type MashRestId,
  type Recipe,
} from "../model";
import { NumberField } from "./fields";
import { MashLadder } from "./MashLadder";
import { ABOUT, CELL, HEAD, InfoToggle, TABLE_FRAME } from "./restTable";
import { SECTION_TITLE_STYLE } from "./styles";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The texts behind an ⓘ, below its row (EDT-031). */
function AboutRow(props: { id: string; rest: string; planned: boolean; items: [string, string][]; duration?: string }) {
  return (
    <tr id={props.id} data-mash-about={props.rest} class={props.planned ? "bg-berry-light/10 dark:bg-berry-light/5" : ""}>
      <td />
      <td colSpan={4} class={`${CELL} pt-0`}>
        <dl class={ABOUT}>
          {props.duration !== undefined && (
            <div>
              <dt class="inline font-semibold">Typical duration:</dt>{" "}
              <dd class="inline" data-mash-typical="minutes">
                {props.duration}
              </dd>
            </div>
          )}
          {props.items.map(([term, text]) => (
            <div key={term}>
              <dt class="inline font-semibold">{term}:</dt> <dd class="inline">{text}</dd>
            </div>
          ))}
        </dl>
      </td>
    </tr>
  );
}

/**
 * The mash-in's row (EDT-031, QE-77): the first row, without a check box (every plan starts with it), with only a
 * temperature field; empty, it is a problem once a rest is ticked (EDT-032).
 */
function MashInRows(props: {
  temperature: unknown;
  problems: Problem[];
  warnings: Warning[];
  open: boolean;
  onToggle: () => void;
  onChange: (temperature: unknown) => void;
}) {
  const at = `mashing.${MASH_IN}.temperature`;
  const notes = notesAt({ problems: props.problems, warnings: props.warnings }, at);
  const about = `mash-about-${MASH_IN}`;
  return (
    <>
      <tr data-mash-rest={MASH_IN} class="bg-berry-light/10 dark:bg-berry-light/5">
        <td class={`${CELL} w-5 sm:w-8`} />
        <td class={CELL}>
          <div class="pt-1.5 text-[13px] leading-snug sm:text-sm sm:leading-normal">
            <span class="font-semibold text-ink dark:text-ink-light">{MASH_IN_INFO.label}</span>{" "}
            {/* The typical range beside the name, grey (amber while outside it; QE-78), as for a rest. */}
            <span
              id={`mash-typical-${MASH_IN}-temperature`}
              data-mash-typical="temperature"
              class={
                "whitespace-nowrap text-[11px] leading-snug tracking-tight sm:text-xs sm:tracking-normal " +
                (hasWarning(notes) ? "font-medium text-amber-700 dark:text-brass-light" : "text-stone-500 dark:text-stone-400")
              }
            >
              ({typicalTemperature(MASH_IN)})
            </span>
            <FieldNotes notes={notes} class="mt-0.5" />
          </div>
        </td>
        <td class={`${CELL} w-12 sm:w-20`}>
          <NumberField
            label={`Temperature (°C), ${MASH_IN_INFO.label}`}
            compact
            unit="°C"
            value={props.temperature}
            invalid={props.problems.some((p) => p.path === at)}
            warn={hasWarning(notes)}
            describedBy={`mash-typical-${MASH_IN}-temperature`}
            onChange={props.onChange}
          />
        </td>
        <td class={`${CELL} w-12 sm:w-20`} />
        <td class={`${CELL} w-7 text-right sm:w-10`}>
          <InfoToggle open={props.open} controls={about} label="About the mash-in" title="About the mash-in" onClick={props.onToggle} />
        </td>
      </tr>
      {props.open && <AboutRow id={about} rest={MASH_IN} planned items={MASH_IN_INFO.about} />}
    </>
  );
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
            {/* The fields' errors and warnings under the name; the typical duration is in the ⓘ (QE-75). */}
            <FieldNotes notes={[...notes("temperature"), ...notes("minutes")]} class="mt-0.5" />
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
              onChange={(v) => props.onChange({ ...rest, minutes: v })}
            />
          )}
        </td>
        <td class={`${CELL} w-7 text-right sm:w-10`}>
          <InfoToggle open={props.open} controls={about} label={`About the ${info.short}`} title="About this rest" onClick={props.onToggle} />
        </td>
      </tr>
      {props.open && <AboutRow id={about} rest={id} planned={planned} items={info.about} duration={info.duration} />}
    </>
  );
}

export function MashingTab(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
  const plan = mashingOf(props.recipe);
  const [open, setOpen] = useState<MashRestId | typeof MASH_IN>();
  const mashIn = plan[MASH_IN];
  const table = useRef<HTMLTableElement>(null);
  /** From the ladder: the rest's details open in the table, and its row comes into view (EDT-037). */
  const showRest = (id: MashRestId | typeof MASH_IN) => {
    setOpen(id);
    table.current?.querySelector(`[data-mash-rest=${id}]`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  return (
    <>
      <section aria-labelledby="mash-ladder-title">
        <h3 id="mash-ladder-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
          Temperature Ladder
        </h3>
        <MashLadder plan={plan} selected={open === MASH_IN ? undefined : open} onSelect={showRest} />
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
                <th class={HEAD}>
                  <span class="sr-only">About</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <MashInRows
                temperature={isObject(mashIn) ? mashIn.temperature : undefined}
                problems={props.problems}
                warnings={props.warnings}
                open={open === MASH_IN}
                onToggle={() => setOpen(open === MASH_IN ? undefined : MASH_IN)}
                onChange={(temperature) => props.onChange(withMashIn(props.recipe, temperature))}
              />
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
