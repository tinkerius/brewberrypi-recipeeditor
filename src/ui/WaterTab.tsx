/**
 * The Water tab (EDT-051..053, EDT-057; QE-36, QE-38): the brewing-day water volumes (mash, sparge and top-up water,
 * app RCP-015) and the knockout volume, with the total water and the mash thickness; and the gravity: the target
 * original gravity and the final gravity (the batch's, app RCP-014), with the alcohol and the attenuation. The
 * knockout volume and the original gravity are entered only here; the Malt and Boiling tabs use them. Computed values
 * are never stored.
 */

import type { ComponentChildren } from "preact";
import type { Problem } from "../validate";
import {
  WATER_FIELDS,
  WATER_LABELS,
  alcoholOf,
  batchOf,
  mashThickness,
  totalWater,
  waterOf,
  withBatchField,
  withWaterField,
  type BatchField,
  type Recipe,
} from "../model";
import { NumberField } from "./fields";
import { HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";

/** Litres with at most one decimal: "32 L", "14.5 L". */
function litres(value: number): string {
  return `${Math.round(value * 10) / 10} L`;
}

const FIELDS = "grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_auto_1fr]";
const HINT = `${HINT_STYLE} col-span-2 mb-2 sm:col-span-1 sm:mb-0`;
const FIGURES =
  "mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-stone-50 p-3 text-sm ring-1 ring-line dark:bg-white/5 dark:ring-white/10";
const TERM = "font-medium text-ink dark:text-ink-light";
const VALUE = "font-semibold tabular-nums text-ink dark:text-ink-light";

/** The batch fields entered on this tab (EDT-050, EDT-057): label, unit and hint. */
const BATCH_FIELDS: Record<BatchField, { label: string; unit: string; hint: string }> = {
  liters: {
    label: "Knockout volume",
    unit: "L",
    hint: "The wort at the end of the boil, the target for the fermenter (used for the beer colour and bitterness).",
  },
  plato: {
    label: "Original gravity (target)",
    unit: "°P",
    hint: "The wort's gravity at the end of the boil (used for the bitterness and the alcohol).",
  },
  final_plato: { label: "Final gravity", unit: "°P", hint: "The beer's gravity after fermentation." },
};

export function WaterTab(props: { recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const water = waterOf(props.recipe);
  const batch = batchOf(props.recipe);
  const invalid = (path: string) => props.problems.some((p) => p.path === path);
  const total = totalWater(props.recipe);
  const thickness = mashThickness(props.recipe);
  const alcohol = alcoholOf(props.recipe);
  const batchField = (field: BatchField): ComponentChildren => (
    <div key={field} class="contents" data-batch-field={field}>
      <NumberField
        label={BATCH_FIELDS[field].label}
        unit={BATCH_FIELDS[field].unit}
        value={batch[field]}
        invalid={invalid(`batch.${field}`)}
        onChange={(v) => props.onChange(withBatchField(props.recipe, field, v))}
      />
      <span class={HINT}>{BATCH_FIELDS[field].hint}</span>
    </div>
  );
  return (
    <>
      <section aria-labelledby="water-title">
        <h3 id="water-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Water
        </h3>
        <div class={FIELDS} data-water-fields>
          {WATER_FIELDS.map((field) => (
            <div key={field} class="contents" data-water={field}>
              <NumberField
                label={WATER_LABELS[field].label}
                unit="L"
                value={water[field]}
                invalid={invalid(`water.${field}`)}
                onChange={(v) => props.onChange(withWaterField(props.recipe, field, v))}
              />
              <span class={HINT}>{WATER_LABELS[field].hint}</span>
            </div>
          ))}
          {/* The batch's knockout volume (EDT-050): entered here only; the Malt and Boiling tabs use it. */}
          <div class="contents" data-knockout>
            {batchField("liters")}
          </div>
        </div>
        <dl class={FIGURES} data-water-figures>
          <dt class={TERM}>Total water</dt>
          <dd data-total-water class={VALUE}>
            {total === undefined ? "–" : litres(total)}
          </dd>
          <dt class={TERM}>Mash thickness</dt>
          <dd>
            <span data-mash-thickness class={VALUE}>
              {"value" in thickness ? `${Math.round(thickness.value * 10) / 10} L/kg` : "–"}
            </span>{" "}
            <span class={HINT_STYLE} data-mash-thickness-hint>
              {"value" in thickness
                ? "(mash water per kg of malt; typical 2.5–4 L/kg)"
                : `Enter ${thickness.missing.map((m) => (m === "mash" ? "the mash water" : "the malts on the Malt tab")).join(" and ")}.`}
            </span>
          </dd>
        </dl>
      </section>
      <section class="mt-6" aria-labelledby="gravity-title">
        <h3 id="gravity-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Gravity
        </h3>
        <div class={FIELDS} data-gravity-fields>
          {batchField("plato")}
          {batchField("final_plato")}
        </div>
        <dl class={FIGURES} data-gravity-figures>
          <dt class={TERM}>Alcohol</dt>
          <dd>
            <span data-alcohol class={VALUE}>
              {"abv" in alcohol ? `${(Math.round(alcohol.abv * 10) / 10).toFixed(1)} % vol` : "–"}
            </span>{" "}
            <span class={HINT_STYLE} data-alcohol-hint>
              {"abv" in alcohol
                ? "(Balling's formula, from the original and final gravity)"
                : alcohol.notBelow
                  ? "The final gravity must be below the original gravity."
                  : `Enter ${alcohol.missing.map((m) => (m === "plato" ? "the original gravity" : "the final gravity")).join(" and ")}.`}
            </span>
          </dd>
          <dt class={TERM}>Apparent attenuation</dt>
          <dd data-attenuation class={VALUE}>
            {"abv" in alcohol ? `${Math.round(alcohol.attenuation)} %` : "–"}
          </dd>
        </dl>
      </section>
    </>
  );
}
