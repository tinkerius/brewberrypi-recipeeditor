/**
 * The Overview tab's summary (EDT-076, EDT-077, QE-85): the list of everything the brew needs, and the brewing time
 * (the mash schedule and the boil). Read-only: computed from the recipe with the other tabs' helpers, never stored.
 */

import {
  ACID_MALT,
  INGREDIENT_LABELS,
  WATER_FIELDS,
  WATER_LABELS,
  boilMinutesOf,
  entryGrams,
  ingredientsOf,
  maltsWithAcidMalt,
  mashInTemperature,
  restsOf,
  totalGrams,
  totalWater,
  validAlpha,
  validWater,
  waterOf,
  yeastOf,
  type Ingredient,
  type Recipe,
} from "./model";
import { DEFAULT_HEATING_RATE, mashProfile, stepsOf } from "./mashSchedule";
import { treatmentTotals } from "./waterTreatment";

/** One line of the list: what, how much ("–" while its amount is missing), and maybe a note ("α 5.5 %"). */
export interface ListLine {
  name: string;
  amount: string;
  note?: string;
}

/** The tab a group is entered on. */
export type ListTab = "malts" | "hops" | "water" | "fermentation";

export interface ListGroup {
  id: "malts" | "hops" | "others" | "yeast" | "water" | "treatment";
  title: string;
  tab: ListTab;
  lines: ListLine[];
  /** The group's total, where adding up makes sense (malt, hops, water). */
  total?: string;
}

/** One decimal, without a trailing ".0": "13.5", "18". */
const oneDecimal = (value: number) => String(Math.round(value * 10) / 10);
const grams = (value: number) => `${oneDecimal(value)} g`;
const litres = (value: number) => `${oneDecimal(value)} L`;
const MISSING = "–";

/** A list's entries, each named (or "Malt 2" while it has no name), with the grams it counts (EDT-043, EDT-061). */
function entryLines(entries: Ingredient[], one: string, note?: (entry: Ingredient) => string | undefined): ListLine[] {
  return entries.map((entry, i) => {
    const g = entryGrams(entry);
    const name = typeof entry.name === "string" && entry.name.trim() !== "" ? entry.name : `${one} ${i + 1}`;
    const extra = note?.(entry);
    return { name, amount: g > 0 ? grams(g) : MISSING, ...(extra ? { note: extra } : {}) };
  });
}

/**
 * Everything the brew needs (EDT-076), in groups in this order, each left out while empty: the malts with the water
 * treatment's acid malt, the hops (all additions of each summed, with its alpha acid), the other additions, the
 * yeast, the water and the water treatment's gypsum and lactic acid for the mash water.
 */
export function ingredientList(recipe: Recipe): ListGroup[] {
  const groups: ListGroup[] = [];
  const malts = maltsWithAcidMalt(recipe);
  const own = ingredientsOf(recipe, "malts").length;
  if (malts.length > 0) {
    const lines = entryLines(malts, INGREDIENT_LABELS.malts.one);
    if (malts.length > own) {
      // The acid malt of the water treatment (EDT-070): shown read-only on the Malt tab, never in the malt list.
      lines[own] = { ...lines[own], name: ACID_MALT.name, note: "from the water treatment" };
    }
    const total = totalGrams(malts);
    groups.push({ id: "malts", title: "Malt", tab: "malts", lines, ...(total > 0 ? { total: grams(total) } : {}) });
  }
  const hops = ingredientsOf(recipe, "hops");
  if (hops.length > 0) {
    const lines = entryLines(hops, INGREDIENT_LABELS.hops.one, (h) => (validAlpha(h.alpha) ? `α ${h.alpha} %` : undefined));
    const total = totalGrams(hops);
    groups.push({ id: "hops", title: "Hops", tab: "hops", lines, ...(total > 0 ? { total: grams(total) } : {}) });
  }
  const others = ingredientsOf(recipe, "others");
  if (others.length > 0) {
    groups.push({ id: "others", title: INGREDIENT_LABELS.others.title, tab: "hops", lines: entryLines(others, INGREDIENT_LABELS.others.one) });
  }
  const yeast = yeastOf(recipe);
  if (yeast.name !== undefined || yeast.grams !== undefined) {
    const name = typeof yeast.name === "string" && yeast.name.trim() !== "" ? yeast.name : "Yeast";
    const amount = typeof yeast.grams === "number" && Number.isFinite(yeast.grams) && yeast.grams > 0 ? grams(yeast.grams) : MISSING;
    groups.push({ id: "yeast", title: "Yeast", tab: "fermentation", lines: [{ name, amount }] });
  }
  const water = waterOf(recipe);
  const volumes = WATER_FIELDS.filter((f) => validWater(water[f]));
  if (volumes.length > 0) {
    const total = totalWater(recipe);
    groups.push({
      id: "water",
      title: "Water",
      tab: "water",
      lines: volumes.map((f) => ({ name: WATER_LABELS[f].label, amount: litres(water[f] as number) })),
      ...(total !== undefined ? { total: litres(total) } : {}),
    });
  }
  // The water treatment's totals for the mash water (EDT-069); the acid malt is with the malts.
  const totals = treatmentTotals(recipe);
  const treatment: ListLine[] = [];
  if (totals.gypsum !== undefined && totals.gypsum > 0) {
    treatment.push({ name: "Brewing gypsum", amount: grams(totals.gypsum) });
  }
  if (totals.lacticAcid !== undefined && totals.lacticAcid > 0) {
    treatment.push({ name: "Lactic acid 80 %", amount: `${oneDecimal(totals.lacticAcid)} ml` });
  }
  if (treatment.length > 0) {
    groups.push({ id: "treatment", title: "Water treatment", tab: "water", lines: treatment });
  }
  return groups;
}

export interface BrewingTime {
  /** The mash schedule (EDT-039): its total, of which rests and heating; undefined while no rest has both values. */
  mash?: { total: number; rests: number; heating: number };
  /** The boil time (EDT-054); undefined while no boil addition has an amount and a cooking time. */
  boil?: number;
  /** Mash + boil, while both are known. */
  total?: number;
  missing: ("mash" | "boil")[];
}

/**
 * The brewing time (EDT-077, QE-85): the mash schedule as on the Mashing tab, at the default heating rate (the tab's
 * rate is a view setting, not stored), plus the boil as in the Boil Schedule. Nothing else is counted.
 */
export function brewingTime(recipe: Recipe): BrewingTime {
  const plan = restsOf(recipe);
  const steps = stepsOf(plan);
  const profile = steps.length > 0 ? mashProfile(steps, DEFAULT_HEATING_RATE, mashInTemperature(plan)) : undefined;
  const mash = profile ? { total: profile.totalMinutes, rests: profile.holdMinutes, heating: profile.rampMinutes } : undefined;
  const boil = boilMinutesOf(recipe);
  const missing = [...(mash ? [] : (["mash"] as const)), ...(boil !== undefined ? [] : (["boil"] as const))];
  return { mash, boil, total: mash && boil !== undefined ? mash.total + boil : undefined, missing };
}
