/**
 * The Water tab (EDT-051..053, EDT-067; QE-36, QE-38, QE-56, QE-58, QE-60): the brewing-day water volumes (mash,
 * sparge and top-up water, app RCP-015) and the knockout volume (the batch's, app RCP-014), each with its typical
 * value (EDT-068): the mash water for the recipe's malt by beer style, the sparge water as an estimate, the top-up
 * water usually 0; then the total water and the mash thickness. The gravity is on the Fermentation tab
 * (`FermentationTab`), which shares the batch fields from here. Computed values are never stored.
 */

import type { ComponentChildren } from "preact";
import type { Problem } from "../validate";
import { TYPICAL, type Warning } from "../warnings";
import { notesAt } from "./notes";
import {
  MASH_WATER_BY_STYLE,
  WATER_FIELDS,
  WATER_LABELS,
  batchOf,
  ingredientsOf,
  mashThickness,
  totalGrams,
  totalWater,
  waterEstimate,
  waterOf,
  withBatchField,
  withWaterField,
  type BatchField,
  type Recipe,
  type WaterField,
} from "../model";
import { NumberField } from "./fields";
import { FieldGrid, FieldRow } from "./FieldGrid";
import { HINT_STYLE, LABEL_STYLE, SECTION_TITLE_STYLE } from "./styles";
import {
  TARGET_BY_COLOUR,
  TREATMENT_TYPICAL,
  degrees,
  treatmentEffects,
  treatmentOf,
  withTreatmentField,
  type Effect,
  type TreatmentField,
} from "../waterTreatment";

/** Litres with at most one decimal: "32 L", "14.5 L". */
function litres(value: number): string {
  return `${oneDecimal(value)} L`;
}

/** One decimal, without a trailing ".0": "13.5", "18". */
const oneDecimal = (value: number) => String(Math.round(value * 10) / 10);

export const FIGURES =
  "mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-stone-50 p-3 text-sm ring-1 ring-line dark:bg-white/5 dark:ring-white/10";
export const TERM = "font-medium text-ink dark:text-ink-light";
export const VALUE = "font-semibold tabular-nums text-ink dark:text-ink-light";

/** The batch fields (EDT-050, EDT-057): label, unit, hint and typical value; the knockout volume here, the gravities on Fermentation. */
const BATCH_FIELDS: Record<BatchField, { label: string; unit: string; hint: string; typical?: string }> = {
  liters: {
    label: "Knockout volume (target)",
    unit: "L",
    hint: "The wort at the end of the boil, the target for the fermenter (used for the beer colour and bitterness).",
  },
  plato: {
    label: "Original gravity (target)",
    unit: "°P",
    hint: "The wort's gravity at the end of the boil (used for the bitterness and the alcohol).",
    typical: `${TYPICAL.plato.min}–${TYPICAL.plato.max} °P`,
  },
  final_plato: {
    label: "Final gravity",
    unit: "°P",
    hint: "The beer's gravity after fermentation.",
    typical: `${TYPICAL.finalPlato.min}–${TYPICAL.finalPlato.max} °P (attenuation ${TYPICAL.attenuation.min}–${TYPICAL.attenuation.max} %)`,
  },
};

/** One batch field in a FieldGrid, with its typical value, errors and warnings (EDT-050, EDT-057, EDT-062, EDT-068). */
export function BatchFieldRow(props: {
  field: BatchField;
  recipe: Recipe;
  problems: Problem[];
  warnings: Warning[];
  onChange: (recipe: Recipe) => void;
}) {
  const { field } = props;
  const path = `batch.${field}`;
  const info = BATCH_FIELDS[field];
  return (
    <div class="contents" data-batch-field={field}>
      <FieldRow
        id={`batch-${field}`}
        field={
          <NumberField
            label={info.label}
            unit={info.unit}
            value={batchOf(props.recipe)[field]}
            invalid={props.problems.some((p) => p.path === path)}
            warn={props.warnings.some((w) => w.path === path)}
            onChange={(v) => props.onChange(withBatchField(props.recipe, field, v))}
          />
        }
        typical={info.typical}
        notes={notesAt({ problems: props.problems, warnings: props.warnings }, path)}
        hint={info.hint}
      />
    </div>
  );
}

/** The mash water by beer style (EDT-067), per kg of malt and in litres for the recipe's malt. */
function StyleTable(props: { kg: number }) {
  const cell = "py-0.5 pr-4 align-top";
  return (
    <>
      <p>
        Mash water by beer style{props.kg > 0 ? ` (for your ${oneDecimal(props.kg)} kg of malt)` : ""}: light beers are mashed thinner, dark
        and strong ones thicker.
      </p>
      <table class="mt-1" data-water-styles>
        <tbody>
          {MASH_WATER_BY_STYLE.map((s) => (
            <tr key={s.styles}>
              <td class={cell}>{s.styles}</td>
              <td class={`${cell} whitespace-nowrap tabular-nums`}>
                {s.min}–{s.max} L/kg
              </td>
              {props.kg > 0 && (
                <td class={`${cell} whitespace-nowrap font-semibold tabular-nums`} data-style-litres>
                  {oneDecimal(s.min * props.kg)}–{oneDecimal(s.max * props.kg)} L
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function WaterTab(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
  const water = waterOf(props.recipe);
  const issues = { problems: props.problems, warnings: props.warnings };
  const total = totalWater(props.recipe);
  const thickness = mashThickness(props.recipe);
  const kg = totalGrams(ingredientsOf(props.recipe, "malts")) / 1000;
  const estimate = waterEstimate(props.recipe);
  const { min, max } = TYPICAL.mashThickness;
  // Each water field's typical value and how it is worked out (EDT-067, EDT-068).
  const typical: Record<WaterField, { typical: string | undefined; info?: { label: string; content: ComponentChildren } }> = {
    mash: {
      typical: kg > 0 ? `${oneDecimal(min * kg)}–${oneDecimal(max * kg)} L (${min}–${max} L/kg)` : `${min}–${max} L/kg of malt`,
      info: { label: "Mash water by beer style", content: <StyleTable kg={kg} /> },
    },
    sparge: {
      typical: "missing" in estimate ? "–" : estimate.sparge === undefined ? "–" : `≈ ${litres(estimate.sparge)}`,
      info: {
        label: "How the sparge water is estimated",
        content:
          "missing" in estimate ? (
            <p data-water-estimate>
              For an estimate of the total and the sparge water, enter{" "}
              {estimate.missing.map((m) => (m === "liters" ? "the knockout volume" : "the malts on the Malt tab")).join(" and ")}.
            </p>
          ) : (
            <div class="space-y-1" data-water-estimate>
              <p data-estimate-total>
                <span class={TERM}>Total water</span> ≈ knockout volume + boil-off + grain absorption + losses ≈{" "}
                {oneDecimal(estimate.knockout)} L + {oneDecimal(estimate.boilOff)} L ({estimate.boilMinutes} min
                {estimate.boilAssumed ? " assumed" : ""}, ~10 %/h) + {oneDecimal(estimate.absorption)} L (~1 L/kg) + {estimate.losses} L ={" "}
                <span class={VALUE}>{litres(estimate.total)}</span>
              </p>
              <p data-estimate-sparge>
                <span class={TERM}>Sparge water</span> ≈ total − mash water − top-up water
                {estimate.sparge === undefined ? (
                  " (enter the mash water)"
                ) : (
                  <>
                    {" "}
                    = <span class={VALUE}>{litres(estimate.sparge)}</span>
                  </>
                )}
              </p>
            </div>
          ),
      },
    },
    top_up: { typical: "usually 0 L" },
  };
  return (
    <section aria-labelledby="water-title">
      <h3 id="water-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
        Water
      </h3>
      <FieldGrid data-water-fields>
        {WATER_FIELDS.map((field) => (
          <div key={field} class="contents" data-water={field}>
            <FieldRow
              id={`water-${field}`}
              field={
                <NumberField
                  label={WATER_LABELS[field].label}
                  unit="L"
                  value={water[field]}
                  invalid={props.problems.some((p) => p.path === `water.${field}`)}
                  warn={props.warnings.some((w) => w.path === `water.${field}`)}
                  onChange={(v) => props.onChange(withWaterField(props.recipe, field, v))}
                />
              }
              typical={typical[field].typical}
              info={typical[field].info}
              notes={notesAt(issues, `water.${field}`)}
              hint={WATER_LABELS[field].hint}
            />
          </div>
        ))}
        {/* The batch's knockout volume (EDT-050): entered here only; the Malt and Boiling tabs use it. */}
        <div class="contents" data-knockout>
          <BatchFieldRow field="liters" {...props} />
        </div>
      </FieldGrid>
      <dl class={FIGURES} data-water-figures>
        <dt class={TERM}>Total water</dt>
        <dd>
          <span data-total-water class={VALUE}>
            {total === undefined ? "–" : litres(total)}
          </span>
          {!("missing" in estimate) && (
            <span class={HINT_STYLE} data-total-estimate>
              {" "}
              (estimate ≈ {litres(estimate.total)})
            </span>
          )}
        </dd>
        <dt class={TERM}>Mash thickness</dt>
        <dd>
          <span data-mash-thickness class={VALUE}>
            {"value" in thickness ? `${oneDecimal(thickness.value)} L/kg` : "–"}
          </span>{" "}
          <span class={HINT_STYLE} data-mash-thickness-hint>
            {"value" in thickness
              ? `(mash water per kg of malt; typical ${min}–${max} L/kg)`
              : `Enter ${thickness.missing.map((m) => (m === "mash" ? "the mash water" : "the malts on the Malt tab")).join(" and ")}.`}
          </span>
        </dd>
      </dl>
      <WaterTreatment {...props} />
    </section>
  );
}

/** What an effect does, or what is missing for it (EDT-069). */
function effectText(effect: Effect): ComponentChildren {
  if (effect === undefined) {
    return null;
  }
  if ("value" in effect) {
    return (
      <span class={VALUE} data-effect>
        {degrees(effect.value, true)}
      </span>
    );
  }
  const what = { carbonate_hardness: "the carbonate hardness", malts: "the malts on the Malt tab", mash: "the mash water" };
  return <span data-effect-missing>Enter {effect.missing.map((m) => what[m]).join(" and ")}.</span>;
}

/**
 * The water treatment (EDT-069, QE-61): the tap water's residual alkalinity and carbonate hardness, what is done to
 * the water and what each does to the residual alkalinity, and the result against the typical target for the beer's
 * colour.
 */
function WaterTreatment(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
  const t = treatmentOf(props.recipe);
  const effects = treatmentEffects(props.recipe);
  const issues = { problems: props.problems, warnings: props.warnings };
  const path = (field: string) => `water.treatment.${field}`;
  const set = (field: TreatmentField, value: unknown) => props.onChange(withTreatmentField(props.recipe, field, value));
  const number = (field: TreatmentField, label: string, unit: string) => (
    <NumberField
      label={label}
      unit={unit}
      value={t[field]}
      invalid={props.problems.some((p) => p.path === path(field))}
      warn={props.warnings.some((w) => w.path === path(field))}
      onChange={(v) => set(field, v)}
    />
  );
  const row = (field: TreatmentField, label: string, unit: string, hint: ComponentChildren, typical?: string) => (
    <div class="contents" data-treatment={field}>
      <FieldRow id={`treatment-${field}`} field={number(field, label, unit)} typical={typical} notes={notesAt(issues, path(field))} hint={hint} />
    </div>
  );
  const effect = (e: Effect, about: string) => (
    <>
      {effectText(e) ?? about}
      {e !== undefined && <> · {about}</>}
    </>
  );
  const target = effects.target;
  return (
    <section class="mt-6" aria-labelledby="treatment-title" data-water-treatment>
      <h3 id="treatment-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
        Water treatment
      </h3>
      <p class={`${HINT_STYLE} mb-3`}>
        The residual alkalinity of the brewing water, in °dH: lower it for pale beers, so the mash gets the right pH.
      </p>
      <FieldGrid data-treatment-fields>
        {row("alkalinity", "Residual alkalinity (tap water)", "°dH", "From your water supplier's analysis.")}
        {row("carbonate_hardness", "Carbonate hardness (tap water)", "°dH", "From the analysis; needed for boiling.")}
        <div class="contents" data-treatment="boil">
          <FieldRow
            id="treatment-boil"
            field={
              <label class="contents">
                <span class={LABEL_STYLE}>Boil the brewing water</span>
                <span class="flex items-center">
                  <input
                    type="checkbox"
                    class="size-4 accent-berry"
                    checked={t.boil === true}
                    onChange={(e) => set("boil", e.currentTarget.checked)}
                  />
                </span>
              </label>
            }
            notes={notesAt(issues, path("boil"))}
            hint={effect(effects.boil, "precipitates carbonate hardness down to about 3 °dH")}
          />
        </div>
        {row("gypsum", "Brewing gypsum", "g/10 L", effect(effects.gypsum, "its calcium lowers the alkalinity"), `up to ${TREATMENT_TYPICAL.gypsum} g/10 L`)}
        {row("acid_malt", "Acid malt (of the grist)", "%", effect(effects.acidMalt, "its lactic acid acts in the mash"), `up to ${TREATMENT_TYPICAL.acidMalt} %`)}
        {row("lactic_acid", "Lactic acid 80 %", "ml/10 L", effect(effects.lacticAcid, "about 3 °dH less per ml per 10 L"))}
        <div class="contents" data-treatment="result">
          <FieldRow
            id="treatment-result"
            field={
              <>
                <span class={`${LABEL_STYLE} font-semibold`}>Residual alkalinity after treatment</span>
                <span class={`${VALUE} text-base`} data-treatment-result>
                  {effects.result === undefined ? "–" : degrees(effects.result)}
                </span>
              </>
            }
            typical={target ? `at most ${target.max} °dH (${target.ebc} EBC, like ${target.beers})` : "–"}
            info={{
              label: "The typical residual alkalinity by beer colour",
              content: (
                <>
                  <p>The typical residual alkalinity at most, by the beer colour of the Malt tab:</p>
                  <table class="mt-1" data-target-table>
                    <tbody>
                      {TARGET_BY_COLOUR.map((b) => (
                        <tr key={b.max}>
                          <td class="py-0.5 pr-4">{b.beers}</td>
                          <td class="py-0.5 pr-4 whitespace-nowrap tabular-nums">
                            {b.upToEbc === Infinity ? `over ${TARGET_BY_COLOUR[TARGET_BY_COLOUR.length - 2].upToEbc} EBC` : `up to ${b.upToEbc} EBC`}
                          </td>
                          <td class="py-0.5 whitespace-nowrap font-semibold tabular-nums">{b.max} °dH</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ),
            }}
            notes={notesAt(issues, path("result"))}
            hint={
              effects.result === undefined
                ? "Enter the tap water's residual alkalinity."
                : target
                  ? "The tap water's plus the effects above."
                  : "The tap water's plus the effects above; the target needs the beer colour (Malt tab)."
            }
          />
        </div>
      </FieldGrid>
    </section>
  );
}
