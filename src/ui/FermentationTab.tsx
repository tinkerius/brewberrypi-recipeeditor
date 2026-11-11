/**
 * The Fermentation tab (EDT-057, EDT-066; QE-56, QE-57), after Water: the gravity, i.e. the target original gravity and
 * the final gravity (the batch's, app RCP-014), with the alcohol and the apparent attenuation; the yeast (its name and
 * amount) and the carbonation (the CO₂ target per litre), the fermentation's (app RCP-017). The original gravity is
 * entered only here; the Boiling tab uses it for the bitterness. Computed values are never stored.
 */

import type { Problem } from "../validate";
import type { Warning } from "../warnings";
import { alcoholOf, fermentationOf, withFermentationField, yeastOf, type Recipe } from "../model";
import { NumberField, TextField } from "./fields";
import { FieldNotes, hasWarning, notesAt, notesWhere } from "./notes";
import { HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";
import { BatchFieldRow, FIELDS, FIGURES, HINT, TERM, VALUE } from "./WaterTab";

export function FermentationTab(props: { recipe: Recipe; problems: Problem[]; warnings: Warning[]; onChange: (recipe: Recipe) => void }) {
  const alcohol = alcoholOf(props.recipe);
  const issues = { problems: props.problems, warnings: props.warnings };
  const invalid = (path: string) => props.problems.some((p) => p.path === path);
  const yeast = yeastOf(props.recipe);
  const set = (field: "name" | "grams" | "co2", value: unknown) => props.onChange(withFermentationField(props.recipe, field, value));
  // The yeast name also carries the problems of the yeast as a whole (e.g. not an object).
  const nameNotes = notesWhere(issues, (p) => p === "fermentation.yeast.name" || p === "fermentation.yeast" || p === "fermentation");
  return (
    <>
      <section aria-labelledby="gravity-title">
        <h3 id="gravity-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Gravity
        </h3>
        <div class={FIELDS} data-gravity-fields>
          <BatchFieldRow field="plato" {...props} />
          <BatchFieldRow field="final_plato" {...props} />
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
      <section class="mt-6" aria-labelledby="yeast-title">
        <h3 id="yeast-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Yeast
        </h3>
        <div class={`${FIELDS} [&_[data-yeast-field=name]_input]:w-56! sm:[&_[data-yeast-field=name]_input]:w-64!`} data-yeast-fields>
          <div class="contents" data-yeast-field="name">
            <TextField
              label="Name"
              placeholder="e.g. Fermentis WB-06"
              value={yeast.name}
              invalid={invalid("fermentation.yeast.name")}
              onChange={(v) => set("name", v)}
            />
            <span class={HINT}>
              The yeast strain or product.
              <FieldNotes notes={nameNotes} class="mt-0.5" />
            </span>
          </div>
          <div class="contents" data-yeast-field="grams">
            <NumberField
              label="Amount"
              unit="g"
              value={yeast.grams}
              invalid={invalid("fermentation.yeast.grams")}
              onChange={(v) => set("grams", v)}
            />
            <span class={HINT}>
              Dry yeast: a packet is often 11.5 g.
              <FieldNotes notes={notesAt(issues, "fermentation.yeast.grams")} class="mt-0.5" />
            </span>
          </div>
        </div>
      </section>
      <section class="mt-6" aria-labelledby="carbonation-title">
        <h3 id="carbonation-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Carbonation
        </h3>
        <div class={FIELDS} data-carbonation-fields>
          <div class="contents" data-co2>
            <NumberField
              label="CO₂ target"
              unit="g/L"
              value={fermentationOf(props.recipe).co2}
              invalid={invalid("fermentation.co2")}
              warn={hasWarning(notesAt(issues, "fermentation.co2"))}
              onChange={(v) => set("co2", v)}
            />
            <span class={HINT}>
              Grams of CO₂ per litre of beer; typical 3.5–7.5 g/L (British ales low, wheat beers high).
              <FieldNotes notes={notesAt(issues, "fermentation.co2")} class="mt-0.5" />
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
