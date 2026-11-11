/**
 * The Water tab (EDT-051..053; QE-36, QE-38, QE-56): the brewing-day water volumes (mash, sparge and top-up water,
 * app RCP-015) and the knockout volume (the batch's, app RCP-014), with the total water and the mash thickness. The
 * gravity moved to the Fermentation tab (`FermentationTab`), which shares the batch fields' look from here. Computed
 * values are never stored.
 */

import type { Problem } from "../validate";
import type { Warning } from "../warnings";
import { FieldNotes, hasWarning, notesAt } from "./notes";
import {
  WATER_FIELDS,
  WATER_LABELS,
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

export const FIELDS = "grid grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_auto_1fr]";
export const HINT = `${HINT_STYLE} col-span-2 mb-2 sm:col-span-1 sm:mb-0`;
export const FIGURES =
  "mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-stone-50 p-3 text-sm ring-1 ring-line dark:bg-white/5 dark:ring-white/10";
export const TERM = "font-medium text-ink dark:text-ink-light";
export const VALUE = "font-semibold tabular-nums text-ink dark:text-ink-light";

/** The batch fields (EDT-050, EDT-057): label, unit and hint; the knockout volume here, the gravities on Fermentation. */
const BATCH_FIELDS: Record<BatchField, { label: string; unit: string; hint: string }> = {
  liters: {
    label: "Knockout volume (target)",
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

/** One batch field with its hint and its errors and warnings (EDT-050, EDT-057, EDT-062). */
export function BatchFieldRow(props: {
  field: BatchField;
  recipe: Recipe;
  problems: Problem[];
  warnings: Warning[];
  onChange: (recipe: Recipe) => void;
}) {
  const { field } = props;
  const path = `batch.${field}`;
  const notes = notesAt({ problems: props.problems, warnings: props.warnings }, path);
  return (
    <div class="contents" data-batch-field={field}>
      <NumberField
        label={BATCH_FIELDS[field].label}
        unit={BATCH_FIELDS[field].unit}
        value={batchOf(props.recipe)[field]}
        invalid={props.problems.some((p) => p.path === path)}
        warn={hasWarning(notes)}
        onChange={(v) => props.onChange(withBatchField(props.recipe, field, v))}
      />
      <span class={HINT}>
        {BATCH_FIELDS[field].hint}
        <FieldNotes notes={notes} class="mt-0.5" />
      </span>
    </div>
  );
}

export function WaterTab(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
  const water = waterOf(props.recipe);
  const invalid = (path: string) => props.problems.some((p) => p.path === path);
  // A field's errors and warnings, under its hint (EDT-062).
  const notes = (path: string) => notesAt({ problems: props.problems, warnings: props.warnings }, path);
  const total = totalWater(props.recipe);
  const thickness = mashThickness(props.recipe);
  const batchField = (field: BatchField) => <BatchFieldRow key={field} field={field} {...props} />;
  return (
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
              warn={hasWarning(notes(`water.${field}`))}
              onChange={(v) => props.onChange(withWaterField(props.recipe, field, v))}
            />
            <span class={HINT}>
              {WATER_LABELS[field].hint}
              <FieldNotes notes={notes(`water.${field}`)} class="mt-0.5" />
            </span>
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
  );
}
