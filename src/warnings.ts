/**
 * The recipe's warnings (EDT-064, QE-54): values outside their typical range. Unlike problems (missing or wrong data,
 * FMT-004, the validator) they never stop saving or downloading; the recipe stays valid. Each warning names the field
 * it is about (its path, as for problems), its message for the list (EDT-020) and a short text shown at the field
 * (EDT-062). Only valid values are checked: a value that is a problem gets no warning as well.
 */

import { scheduleWarnings, stepsOf } from "./mashSchedule";
import { TREATMENT_TYPICAL, degrees, treatmentEffects, treatmentOf } from "./waterTreatment";
import {
  additionsOf,
  alcoholOf,
  batchOf,
  fermentationOf,
  ingredientsOf,
  isMashRestId,
  mashThickness,
  mashingOf,
  outsideTypicalRange,
  typicalTemperature,
  validAlpha,
  validBoilMinutes,
  type Recipe,
} from "./model";

export interface Warning {
  /** The field it is about, like a problem's path ("batch.plato"); "mashing" for the whole mashing plan. */
  path: string;
  /** For the list below the tabs (EDT-020). */
  message: string;
  /** At the field (EDT-062); its message when there is room. */
  short: string;
}

/** The typical ranges outside which the editor warns (EDT-064, QE-54). */
export const TYPICAL = {
  mashThickness: { min: 2.5, max: 5 }, // L/kg (QE-58: a thin Pils mash is typical)
  plato: { min: 7, max: 22 }, // °P
  finalPlato: { min: 1, max: 5 }, // °P
  attenuation: { min: 65, max: 85 }, // %
  alpha: { min: 2, max: 20 }, // %
  hopMinutes: { max: 90 },
  co2: { min: 3.5, max: 7.5 }, // g/L
} as const;

const outside = (value: number, range: { min: number; max: number }) => value < range.min || value > range.max;
const round1 = (value: number) => Math.round(value * 10) / 10;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function warningsOf(recipe: Recipe): Warning[] {
  const warnings: Warning[] = [];
  // The mashing plan (EDT-033, EDT-038): a rest's temperature outside its typical range, and the schedule's warnings.
  const plan = mashingOf(recipe);
  for (const [id, rest] of Object.entries(plan)) {
    if (isMashRestId(id) && typeof rest === "object" && rest !== null) {
      const temperature = (rest as { temperature?: unknown }).temperature;
      if (finite(temperature) && temperature >= 0 && temperature <= 110 && outsideTypicalRange(id, temperature)) {
        warnings.push({
          path: `mashing.${id}.temperature`,
          message: `${temperature} °C is outside the typical range (${typicalTemperature(id)}).`,
          short: "⚠ Outside the typical range",
        });
      }
    }
  }
  for (const w of scheduleWarnings(stepsOf(plan))) {
    const field = w.field ?? "temperature";
    warnings.push({
      path: w.restId ? `mashing.${w.restId}.${field}` : "mashing",
      message: w.message,
      short: field === "minutes" ? "⚠ Outside the typical duration" : `⚠ ${w.message}`,
    });
  }
  // The water (EDT-052): the mash thickness, at the mash water.
  const thickness = mashThickness(recipe);
  if ("value" in thickness && outside(thickness.value, TYPICAL.mashThickness)) {
    const { min, max } = TYPICAL.mashThickness;
    const message = `A mash thickness of ${round1(thickness.value)} L/kg is outside the typical ${min}–${max} L/kg.`;
    warnings.push({ path: "water.mash", message, short: `⚠ ${message}` });
  }
  // The gravity (EDT-057): the original and final gravity and the apparent attenuation (at the final gravity).
  const { plato, final_plato: finalPlato } = batchOf(recipe);
  const gravity = (path: string, what: string, value: unknown, range: { min: number; max: number }) => {
    if (finite(value) && value >= 0 && value <= 40 && outside(value, range)) {
      const message = `${what} of ${value} °P is outside the typical ${range.min}–${range.max} °P.`;
      warnings.push({ path, message, short: `⚠ ${message}` });
    }
  };
  gravity("batch.plato", "An original gravity", plato, TYPICAL.plato);
  gravity("batch.final_plato", "A final gravity", finalPlato, TYPICAL.finalPlato);
  const alcohol = alcoholOf(recipe);
  if ("abv" in alcohol && outside(alcohol.attenuation, TYPICAL.attenuation)) {
    const { min, max } = TYPICAL.attenuation;
    const message = `An apparent attenuation of ${Math.round(alcohol.attenuation)} % is outside the typical ${min}–${max} %.`;
    warnings.push({ path: "batch.final_plato", message, short: `⚠ ${message}` });
  }
  // The carbonation (EDT-066): the CO₂ target.
  const co2 = fermentationOf(recipe).co2;
  if (finite(co2) && co2 > 0 && outside(co2, TYPICAL.co2)) {
    const { min, max } = TYPICAL.co2;
    const message = `A CO₂ target of ${co2} g/L is outside the typical ${min}–${max} g/L.`;
    warnings.push({ path: "fermentation.co2", message, short: `⚠ ${message}` });
  }
  // The water treatment (EDT-069): the result above the target for the beer colour, much gypsum or acid malt.
  const treatment = treatmentOf(recipe);
  const effects = treatmentEffects(recipe);
  if (effects.result !== undefined && effects.target && effects.result > effects.target.max) {
    const message = `A residual alkalinity of ${degrees(effects.result)} after treatment is above the typical ${effects.target.max} °dH at most for a beer of ${effects.target.ebc} EBC.`;
    warnings.push({ path: "water.treatment.result", message, short: `⚠ ${message}` });
  }
  if (finite(treatment.gypsum) && treatment.gypsum > TREATMENT_TYPICAL.gypsum) {
    const message = `${treatment.gypsum} g of brewing gypsum per 10 L of mash water is above the typical ${TREATMENT_TYPICAL.gypsum} g at most.`;
    warnings.push({ path: "water.treatment.gypsum", message, short: `⚠ ${message}` });
  }
  if (finite(treatment.acid_malt) && treatment.acid_malt <= 100 && treatment.acid_malt > TREATMENT_TYPICAL.acidMalt) {
    const message = `${treatment.acid_malt} % acid malt is above the typical ${TREATMENT_TYPICAL.acidMalt} % at most.`;
    warnings.push({ path: "water.treatment.acid_malt", message, short: `⚠ ${message}` });
  }
  // The hops (EDT-049, EDT-061): the alpha acid, and each addition's cooking time.
  ingredientsOf(recipe, "hops").forEach((hop, i) => {
    const at = `ingredients.hops[${i}]`;
    if (validAlpha(hop.alpha) && outside(hop.alpha, TYPICAL.alpha)) {
      const { min, max } = TYPICAL.alpha;
      warnings.push({
        path: `${at}.alpha`,
        message: `An alpha acid of ${hop.alpha} % is outside the typical ${min}–${max} %.`,
        short: `⚠ α typically ${min}–${max} %`,
      });
    }
    additionsOf(hop).forEach((a, j) => {
      if (validBoilMinutes(a.minutes) && a.minutes > TYPICAL.hopMinutes.max) {
        warnings.push({
          path: `${at}.additions[${j}].minutes`,
          message: `Addition ${j + 1}: a cooking time of ${a.minutes} min is above the typical ${TYPICAL.hopMinutes.max} min.`,
          short: `⚠ Addition ${j + 1}: typically up to ${TYPICAL.hopMinutes.max} min`,
        });
      }
    });
  });
  return warnings;
}
