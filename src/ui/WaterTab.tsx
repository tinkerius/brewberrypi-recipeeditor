/**
 * The Water tab (EDT-051..053, QE-36): the brewing-day water volumes (mash, sparge and top-up water, app RCP-015)
 * and the knockout volume (the batch's, shared with the Malt and Hops tabs), with the total water and the mash
 * thickness computed from them (never stored).
 */

import type { Problem } from "../validate";
import {
  WATER_FIELDS,
  WATER_LABELS,
  batchOf,
  mashThickness,
  totalWater,
  waterOf,
  withBatchField,
  withWaterField,
  type Recipe,
} from "../model";
import { NumberField } from "./fields";
import { HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";

/** Litres with at most one decimal: "32 L", "14.5 L". */
function litres(value: number): string {
  return `${Math.round(value * 10) / 10} L`;
}

export function WaterTab(props: { recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const water = waterOf(props.recipe);
  const invalid = (field: string) => props.problems.some((p) => p.path === `water.${field}`);
  const total = totalWater(props.recipe);
  const thickness = mashThickness(props.recipe);
  return (
    <>
      <p class={HINT_STYLE}>The water of the brewing day, in litres.</p>
      <section class="mt-4" aria-labelledby="water-title">
        <h3 id="water-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Water
        </h3>
        <div class="grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_auto_1fr]" data-water-fields>
          {WATER_FIELDS.map((field) => (
            <div key={field} class="contents" data-water={field}>
              <NumberField
                label={WATER_LABELS[field].label}
                unit="L"
                value={water[field]}
                invalid={invalid(field)}
                onChange={(v) => props.onChange(withWaterField(props.recipe, field, v))}
              />
              <span class={`${HINT_STYLE} col-span-2 mb-2 sm:col-span-1 sm:mb-0`}>{WATER_LABELS[field].hint}</span>
            </div>
          ))}
          {/* The batch's knockout volume (EDT-050), the same field as on the Malt and Hops tabs. */}
          <div class="contents" data-knockout>
            <NumberField
              label="Knockout volume"
              unit="L"
              value={batchOf(props.recipe).liters}
              invalid={props.problems.some((p) => p.path === "batch.liters")}
              onChange={(v) => props.onChange(withBatchField(props.recipe, "liters", v))}
            />
            <span class={`${HINT_STYLE} col-span-2 sm:col-span-1`}>
              The wort at the end of the boil, the target for the fermenter (also on the Malt and Hops tabs).
            </span>
          </div>
        </div>
      </section>
      <dl
        class="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-stone-50 p-3 text-sm ring-1 ring-line dark:bg-white/5 dark:ring-white/10"
        data-water-figures
      >
        <dt class="font-medium text-ink dark:text-ink-light">Total water</dt>
        <dd data-total-water class="font-semibold tabular-nums text-ink dark:text-ink-light">
          {total === undefined ? "–" : litres(total)}
        </dd>
        <dt class="font-medium text-ink dark:text-ink-light">Mash thickness</dt>
        <dd>
          <span data-mash-thickness class="font-semibold tabular-nums text-ink dark:text-ink-light">
            {"value" in thickness ? `${Math.round(thickness.value * 10) / 10} L/kg` : "–"}
          </span>{" "}
          <span class={HINT_STYLE} data-mash-thickness-hint>
            {"value" in thickness
              ? "(mash water per kg of malt; typical 2.5–4 L/kg)"
              : `Enter ${thickness.missing.map((m) => (m === "mash" ? "the mash water" : "the malts on the Malt tab")).join(" and ")}.`}
          </span>
        </dd>
      </dl>
    </>
  );
}
