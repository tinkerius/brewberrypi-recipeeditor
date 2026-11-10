/**
 * The Mashing tab (EDT-030..035, QE-32): the brewer's mashing plan. Every rest of the catalogue is one row, in
 * temperature order; a ticked rest gets its temperature and duration. A temperature outside the rest's typical
 * range is a warning, not a problem: the file stays valid.
 */

import type { Problem } from "../validate";
import {
  MASH_REST_IDS,
  MASH_RESTS,
  mashingOf,
  newMashRest,
  outsideTypicalRange,
  withMashRest,
  type MashRest,
  type MashRestId,
  type Recipe,
} from "../model";
import { NumberField } from "./fields";
import { HINT_STYLE } from "./styles";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function RestRow(props: {
  id: MashRestId;
  rest: MashRest | undefined;
  problems: Problem[];
  onChange: (rest: MashRest | undefined) => void;
}) {
  const { id, rest } = props;
  const info = MASH_RESTS[id];
  const planned = rest !== undefined;
  const at = `mashing.${id}`;
  const invalid = (field: string) => props.problems.some((p) => p.path === `${at}.${field}`);
  const warn = planned && outsideTypicalRange(id, rest.temperature);
  const checkbox = `mash-${id}`;
  return (
    <li class="px-3 py-3" data-mash-rest={id}>
      <div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <label for={checkbox} class="flex cursor-pointer items-baseline gap-2">
          <input
            id={checkbox}
            type="checkbox"
            class="size-4 shrink-0 translate-y-0.5 accent-berry"
            checked={planned}
            onChange={(e) => props.onChange(e.currentTarget.checked ? newMashRest(id) : undefined)}
          />
          <span class="text-sm font-semibold text-ink dark:text-ink-light">{info.label}</span>
        </label>
        <span class={`${HINT_STYLE} ml-6 sm:ml-0 sm:text-right`}>
          {info.range} · {info.duration}
        </span>
      </div>
      {planned && (
        <div class="mt-2 ml-6 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <NumberField
            label="Temperature"
            unit="°C"
            value={rest.temperature}
            invalid={invalid("temperature")}
            onChange={(v) => props.onChange({ ...rest, temperature: v })}
          />
          <NumberField
            label="Duration"
            unit="min"
            integer
            value={rest.minutes}
            invalid={invalid("minutes")}
            onChange={(v) => props.onChange({ ...rest, minutes: v })}
          />
        </div>
      )}
      {warn && (
        <p class="mt-2 ml-6 text-xs font-medium text-amber-700 dark:text-brass-light" data-mash-warning>
          ⚠ {rest.temperature} °C is outside the typical range of this rest: {info.range}.
        </p>
      )}
      <details class="mt-1 ml-6">
        <summary class={`${HINT_STYLE} cursor-pointer select-none`}>About this rest</summary>
        <dl class="mt-1 space-y-1 text-xs text-stone-700 dark:text-stone-300">
          {info.about.map(([term, text]) => (
            <div key={term}>
              <dt class="inline font-semibold">{term}:</dt> <dd class="inline">{text}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}

export function MashingTab(props: { recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const plan = mashingOf(props.recipe);
  return (
    <>
      <p class={HINT_STYLE}>
        Plan the rests of the mash: tick the rests you want and set their temperature and duration. The plan is kept
        in the recipe file; it doesn't change the goals of the mash process.
      </p>
      <ul class="mt-2 divide-y divide-line rounded-lg ring-1 ring-line dark:divide-white/10 dark:ring-white/10">
        {MASH_REST_IDS.map((id) => {
          const rest = plan[id];
          return (
            <RestRow
              key={id}
              id={id}
              rest={rest === undefined ? undefined : isObject(rest) ? (rest as MashRest) : {}}
              problems={props.problems}
              onChange={(next) => props.onChange(withMashRest(props.recipe, id, next))}
            />
          );
        })}
      </ul>
    </>
  );
}
