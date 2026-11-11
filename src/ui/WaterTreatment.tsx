/**
 * The water treatment (EDT-069, QE-61..QE-64): a table in the look of the Mashing tab's Rests table (its master,
 * `restTable.tsx`). The tap water's residual alkalinity, the steps ticked like rests (boiling, with the tap water's
 * carbonate hardness; gypsum; acid malt; lactic acid; no presets), each step's typical value with its notes, its
 * effect in its own column, an ⓘ for what it does; the foot line, the residual alkalinity after treatment, is the
 * Effect column's total, against the typical target for the beer's colour.
 */

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { Recipe } from "../model";
import type { Problem } from "../validate";
import type { Warning } from "../warnings";
import {
  TARGET_BY_COLOUR,
  TREATMENT_TYPICAL,
  degrees,
  stepOn,
  treatmentEffects,
  treatmentOf,
  withTreatmentField,
  withTreatmentStep,
  stepFormula,
  type Effect,
  type FormulaRow,
  type TreatmentField,
  type TreatmentStep,
} from "../waterTreatment";
import { NumberField } from "./fields";
import { FieldNotes, notesAt, notesWhere } from "./notes";
import { ABOUT, CELL, CHECKBOX, HEAD, InfoToggle, NAME, PLANNED, ROW, TABLE_FRAME, VALUE } from "./restTable";
import { HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";

/** An effect in the Effect column (QE-62): signed °dH, or "–" while unused or not yet worked out. */
function effectValue(effect: Effect): string {
  return effect !== undefined && "value" in effect ? degrees(effect.value, true) : "–";
}

/** What to enter while an effect can't be worked out yet; undefined otherwise. */
function missingText(effect: Effect): string | undefined {
  if (effect === undefined || "value" in effect) {
    return undefined;
  }
  const what = { carbonate_hardness: "the carbonate hardness", malts: "the malts on the Malt tab", mash: "the mash water" };
  return `Enter ${effect.missing.map((m) => what[m]).join(" and ")}.`;
}

type RowId = "alkalinity" | TreatmentStep | "result";

/** The rows: their names (short on a phone), fields and explanations. */
const ROWS: Record<
  Exclude<RowId, "result">,
  { name: string; short: string; field: { key: TreatmentField; label: string; unit: string }; about: string; typical?: string }
> = {
  alkalinity: {
    name: "Residual alkalinity (tap water)",
    short: "Tap water RA",
    field: { key: "alkalinity", label: "Residual alkalinity (tap water)", unit: "°dH" },
    about: "From your water supplier's analysis: the starting value.",
  },
  boil: {
    name: "Boil the brewing water",
    short: "Boil",
    field: { key: "carbonate_hardness", label: "Carbonate hardness (tap water)", unit: "°dH KH" },
    about:
      "Enter the tap water's carbonate hardness (from the analysis). Boiling precipitates it down to about 3 °dH, with as " +
      "much calcium hardness: the residual alkalinity falls by (1 − 1/3.5) per °dH removed.",
  },
  gypsum: {
    name: "Brewing gypsum",
    short: "Gypsum",
    field: { key: "gypsum", label: "Brewing gypsum", unit: "g/10 L" },
    about: "Its calcium lowers the residual alkalinity: 1 g per 10 L adds 23 mg/L of calcium, about −0.93 °dH.",
    typical: `up to ${TREATMENT_TYPICAL.gypsum} g/10 L`,
  },
  acid_malt: {
    name: "Acid malt (of the grist)",
    short: "Acid malt",
    field: { key: "acid_malt", label: "Acid malt (of the grist)", unit: "%" },
    about: "Its lactic acid (about 3 % of the malt) acts in the mash: worked out from the malts' weight and the mash water.",
    typical: `up to ${TREATMENT_TYPICAL.acidMalt} %`,
  },
  lactic_acid: {
    name: "Lactic acid 80 %",
    short: "Lactic acid",
    field: { key: "lactic_acid", label: "Lactic acid 80 %", unit: "ml/10 L" },
    about: "Lowers the residual alkalinity by about 3 °dH per ml per 10 L.",
  },
};

/** How a row's value is worked out (EDT-069, QE-65): the formula, and with the recipe's numbers once it can be. */
function Formula(props: { recipe: Recipe; row: FormulaRow }) {
  const { formula, filled } = stepFormula(props.recipe, props.row);
  const code = "block font-mono text-[11px] leading-snug break-words whitespace-normal sm:text-xs";
  return (
    <>
      <code class={`${code} text-stone-600 dark:text-stone-300`} data-formula>
        {formula}
      </code>
      {filled && (
        <code class={`${code} font-semibold text-ink dark:text-ink-light`} data-formula-filled>
          {filled}
        </code>
      )}
    </>
  );
}

export function WaterTreatment(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
  const t = treatmentOf(props.recipe);
  const effects = treatmentEffects(props.recipe);
  const issues = { problems: props.problems, warnings: props.warnings };
  const path = (field: string) => `water.treatment.${field}`;
  // One explanation open at a time, like the rests (EDT-031).
  const [open, setOpen] = useState<RowId>();
  const stepEffect: Record<TreatmentStep, Effect> = {
    boil: effects.boil,
    gypsum: effects.gypsum,
    acid_malt: effects.acidMalt,
    lactic_acid: effects.lacticAcid,
  };
  const input = (field: { key: TreatmentField; label: string; unit: string }, keepTicked: boolean) => (
    <NumberField
      label={field.label}
      compact
      unit={field.unit}
      value={t[field.key] ?? undefined}
      invalid={props.problems.some((p) => p.path === path(field.key))}
      warn={props.warnings.some((w) => w.path === path(field.key))}
      // Clearing a ticked step's amount keeps it ticked (empty, a problem until entered).
      onChange={(v) => props.onChange(withTreatmentField(props.recipe, field.key, v === undefined && keepTicked ? null : v))}
    />
  );
  const name = (text: { name: string; short: string }, htmlFor?: string) => (
    <label for={htmlFor} class={`block pt-1.5 ${NAME} ${htmlFor ? "cursor-pointer" : ""}`}>
      {/* On a phone the short name, so the columns fit (as the rests). */}
      <span class="sm:hidden">{text.short}</span>
      <span class="hidden sm:inline">{text.name}</span>
    </label>
  );
  const toggle = (id: RowId, label: string) => (
    <InfoToggle
      open={open === id}
      controls={`treatment-about-${id}`}
      label={label}
      title={label}
      onClick={() => setOpen(open === id ? undefined : id)}
    />
  );
  const aboutRow = (id: RowId, planned: boolean, content: ComponentChildren) =>
    open === id && (
      <tr id={`treatment-about-${id}`} data-treatment-about={id} class={planned ? PLANNED : ""}>
        <td />
        <td colSpan={5} class={`${CELL} pt-0`}>
          <div class={ABOUT}>{content}</div>
        </td>
      </tr>
    );
  /** A row of the table: checkbox (or nothing), name, field, typical value with notes, effect, ⓘ. */
  const row = (id: Exclude<RowId, "result">, on: boolean | undefined) => {
    const info = ROWS[id];
    const step = id === "alkalinity" ? undefined : id;
    const effect = step ? stepEffect[step] : undefined;
    const ticked = on ?? true;
    const missing = step && ticked ? missingText(effect) : undefined;
    const notes = step
      ? notesWhere(issues, (p) => p === path(step) || (step === "boil" && p === path("carbonate_hardness")))
      : notesAt(issues, path("alkalinity"));
    const checkbox = `treatment-step-${id}`;
    const alkalinity = t.alkalinity;
    return (
      <>
        <tr class={`${ROW} ${step && ticked ? PLANNED : ""}`} data-treatment={id} data-treatment-on={step && ticked ? "" : undefined}>
          <td class={`${CELL} w-5 sm:w-8`}>
            {step && (
              <input
                id={checkbox}
                type="checkbox"
                class={CHECKBOX}
                checked={ticked}
                onChange={(e) => props.onChange(withTreatmentStep(props.recipe, step, e.currentTarget.checked))}
              />
            )}
          </td>
          <td class={CELL}>{name(info, step ? checkbox : undefined)}</td>
          <td class={`${CELL} w-16 sm:w-28`}>{ticked && input(info.field, step !== undefined && step !== "boil")}</td>
          <td class={CELL}>
            <div class={VALUE}>
              {info.typical && (
                <span data-typical class="text-[11px] leading-snug text-stone-500 sm:text-xs dark:text-stone-400">
                  {info.typical}
                </span>
              )}
              <FieldNotes notes={notes} />
              {missing && (
                <span class="text-[11px] leading-snug text-stone-500 sm:text-xs dark:text-stone-400" data-effect-missing>
                  {missing}
                </span>
              )}
            </div>
          </td>
          <td class={`${CELL} text-right`}>
            <div class={`${VALUE} justify-end text-sm font-semibold whitespace-nowrap tabular-nums text-ink dark:text-ink-light`} data-effect-cell>
              {step
                ? ticked
                  ? effectValue(effect)
                  : "–"
                : typeof alkalinity === "number" && Number.isFinite(alkalinity)
                  ? degrees(alkalinity)
                  : "–"}
            </div>
          </td>
          <td class={`${CELL} w-7 text-right sm:w-10`}>{toggle(id, `About: ${info.name}`)}</td>
        </tr>
        {aboutRow(
          id,
          Boolean(step && ticked),
          <>
            <p data-treatment-hint>{info.about}</p>
            <Formula recipe={props.recipe} row={id} />
          </>,
        )}
      </>
    );
  };
  const target = effects.target;
  const resultNotes = notesAt(issues, path("result"));
  return (
    <section class="mt-6" aria-labelledby="treatment-title" data-water-treatment>
      <h3 id="treatment-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
        Water treatment
      </h3>
      <p class={`${HINT_STYLE} mb-2`}>
        The residual alkalinity of the brewing water, in °dH: lower it for pale beers, so the mash gets the right pH. Tick
        the steps you use.
      </p>
      <div class={TABLE_FRAME}>
        <table aria-labelledby="treatment-title" class="w-full border-collapse" data-treatment-table>
          <thead class="bg-stone-50 dark:bg-white/5">
            <tr>
              <th class={HEAD}>
                <span class="sr-only">Used</span>
              </th>
              <th class={HEAD}>Step</th>
              <th class={HEAD}>Value</th>
              <th class={HEAD}>Typical</th>
              <th class={`${HEAD} text-right`}>Effect</th>
              <th class={HEAD}>
                <span class="sr-only">About</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {row("alkalinity", undefined)}
            {(["boil", "gypsum", "acid_malt", "lactic_acid"] as const).map((step) => row(step, stepOn(props.recipe, step)))}
          </tbody>
          {/* The result: the Effect column's total, like a table's Total line (QE-62). */}
          <tfoot class="border-t-2 border-line dark:border-white/20" data-treatment="result">
            <tr>
              <td class={CELL} />
              <td class={CELL} colSpan={2}>
                <span class={`block pt-1.5 ${NAME}`}>
                  <span class="sm:hidden">After treatment</span>
                  <span class="hidden sm:inline">Residual alkalinity after treatment</span>
                </span>
              </td>
              <td class={CELL}>
                <div class={VALUE}>
                  <span
                    data-typical
                    class={
                      "text-[11px] leading-snug sm:text-xs " +
                      (resultNotes.length > 0 ? "font-medium text-amber-700 dark:text-brass-light" : "text-stone-500 dark:text-stone-400")
                    }
                  >
                    {target ? `at most ${target.max} °dH (${target.ebc} EBC, like ${target.beers})` : "–"}
                  </span>
                  <FieldNotes notes={resultNotes} />
                </div>
              </td>
              <td class={`${CELL} text-right`}>
                <div class={`${VALUE} justify-end text-sm font-bold whitespace-nowrap tabular-nums text-ink dark:text-ink-light`} data-effect-cell>
                  <span data-treatment-result>{effects.result === undefined ? "–" : degrees(effects.result)}</span>
                </div>
              </td>
              <td class={`${CELL} w-7 text-right sm:w-10`}>{toggle("result", "About: Residual alkalinity after treatment")}</td>
            </tr>
            {aboutRow(
              "result",
              false,
              <>
                <p data-treatment-hint>
                  The sum of the effects{effects.result === undefined ? " (enter the tap water's residual alkalinity)" : ""}.
                </p>
                <Formula recipe={props.recipe} row="result" />
                <p class="pt-1">Typical at most, by the beer colour of the Malt tab:</p>
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
              </>,
            )}
          </tfoot>
        </table>
      </div>
    </section>
  );
}
