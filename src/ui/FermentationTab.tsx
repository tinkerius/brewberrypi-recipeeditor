/**
 * The Fermentation tab (EDT-057, EDT-066, EDT-068; QE-56, QE-57, QE-60), after Water: the gravity, i.e. the target
 * original gravity and the final gravity (the batch's, app RCP-014), with the alcohol and the apparent attenuation; the
 * yeast (its name and amount) and the carbonation (the CO₂ target per litre), the fermentation's (app RCP-017). Each
 * field with its typical value like on the Water tab. The original gravity is entered only here; the Boiling tab uses
 * it for the bitterness. Computed values are never stored.
 */

import type { Problem } from "../validate";
import { TYPICAL, type Warning } from "../warnings";
import { alcoholOf, fermentationOf, withFermentationField, yeastOf, type Recipe } from "../model";
import { FieldGrid, FieldRow } from "./FieldGrid";
import { NumberField, TextField } from "./fields";
import { notesAt, notesWhere } from "./notes";
import { HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";
import { BatchFieldRow, FIGURES, TERM, VALUE } from "./WaterTab";

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
        <FieldGrid data-gravity-fields>
          <BatchFieldRow field="plato" {...props} />
          <BatchFieldRow field="final_plato" {...props} />
        </FieldGrid>
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
        <FieldGrid data-yeast-fields>
          <div class="contents [&_input]:w-48! sm:[&_input]:w-full!" data-yeast-field="name">
            <FieldRow
              id="yeast-name"
              field={
                <TextField
                  label="Name"
                  placeholder="e.g. Fermentis WB-06"
                  value={yeast.name}
                  invalid={invalid("fermentation.yeast.name")}
                  onChange={(v) => set("name", v)}
                />
              }
              notes={nameNotes}
              hint="The yeast strain or product."
            />
          </div>
          <div class="contents" data-yeast-field="grams">
            <FieldRow
              id="yeast-grams"
              field={
                <NumberField
                  label="Amount"
                  unit="g"
                  value={yeast.grams}
                  invalid={invalid("fermentation.yeast.grams")}
                  onChange={(v) => set("grams", v)}
                />
              }
              notes={notesAt(issues, "fermentation.yeast.grams")}
              hint="Dry yeast: a packet is often 11.5 g."
            />
          </div>
        </FieldGrid>
      </section>
      <section class="mt-6" aria-labelledby="carbonation-title">
        <h3 id="carbonation-title" class={`${SECTION_TITLE_STYLE} mb-3`}>
          Carbonation
        </h3>
        <FieldGrid data-carbonation-fields>
          <div class="contents" data-co2>
            <FieldRow
              id="co2"
              field={
                <NumberField
                  label="CO₂ target"
                  unit="g/L"
                  value={fermentationOf(props.recipe).co2}
                  invalid={invalid("fermentation.co2")}
                  warn={props.warnings.some((w) => w.path === "fermentation.co2")}
                  onChange={(v) => set("co2", v)}
                />
              }
              typical={`${TYPICAL.co2.min}–${TYPICAL.co2.max} g/L`}
              notes={notesAt(issues, "fermentation.co2")}
              hint="Grams of CO₂ per litre of beer (British ales low, wheat beers high)."
            />
          </div>
        </FieldGrid>
      </section>
    </>
  );
}
