/**
 * The recipe's warnings (EDT-064, QE-54): values outside their typical range. Unlike problems (missing or wrong data,
 * FMT-004, the validator) they never stop saving or downloading; the recipe stays valid. Each warning names the field
 * it is about (its path, as for problems), its message for the list (EDT-020) and a short text shown at the field
 * (EDT-062). Only valid values are checked: a value that is a problem gets no warning as well.
 */

import { scheduleWarnings, stepsOf } from "./mashSchedule";
import {
  additionsOf,
  alcoholOf,
  batchOf,
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
  mashThickness: { min: 2.5, max: 4 }, // L/kg
  plato: { min: 7, max: 22 }, // °P
  finalPlato: { min: 1, max: 5 }, // °P
  attenuation: { min: 65, max: 85 }, // %
  alpha: { min: 2, max: 20 }, // %
  hopMinutes: { max: 90 },
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
