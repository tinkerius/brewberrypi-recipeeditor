/**
 * Recipe and goal types: the recipe file format of brewberrypi-app (data/recipe.schema.json, spec 04 and 07 §7.2):
 * { "version": 3, "name": …, "mashing_process": { "goals": […] }, "mashing": { … } }, one recipe per file, the file
 * name is the id. The goals may be empty (app Q-34): the app then lists the recipe but can't load it. "mashing" is
 * the optional mashing plan (app Q-37, RCP-012): the rests the brewer plans, keyed by rest id; the app doesn't use it.
 */

import { alcoholByVolume, apparentAttenuation, beerColourEbc, bitternessIbu } from "./brewMath";
import { MASH_RESTS, MASH_REST_IDS, type MashRestId } from "./mashRests";

export * from "./mashRests";

/** The recipe file format version this editor reads and writes (RCP-008: the app's latest version). */
export const FORMAT_VERSION = 3;

export const GOAL_TYPES = [
  "PourInBrewingWater",
  "HeatUp",
  "MashIn",
  "Rest",
  "IodineTest",
  "Lautering",
  "HeatUpForHopsCooking",
  "CookWater",
] as const;

export type GoalType = (typeof GOAL_TYPES)[number];

export type GoalField = "temperature" | "minutes" | "name" | "description";

/** A goal as it is edited: known fields, plus whatever an uploaded file contained (reported by the validator). */
export type Goal = { type: string } & Partial<Record<GoalField, unknown>> & Record<string, unknown>;

export interface MashingProcess {
  goals: Goal[];
  [key: string]: unknown;
}

export interface Recipe {
  version?: unknown;
  name: string;
  /** The brewer's free text, possibly several lines (app RCP-016); absent while empty. */
  description?: unknown;
  mashing_process: MashingProcess;
  /** The mashing plan (app RCP-012); absent while no rest is planned. */
  mashing?: unknown;
  /** The malts and hops (app RCP-013); absent while there are none. */
  ingredients?: unknown;
  /** The knockout volume and original gravity (app RCP-014); absent while neither is set. */
  batch?: unknown;
  /** The brewing-day water in litres (app RCP-015); absent while none is set. */
  water?: unknown;
  /** The yeast and the target carbonation (app RCP-017); absent while neither is set. */
  fermentation?: unknown;
  [key: string]: unknown;
}

/** A planned rest as it is edited: temperature and minutes, plus whatever an uploaded file contained. */
export type MashRest = { temperature?: unknown; minutes?: unknown } & Record<string, unknown>;

export function isMashRestId(id: unknown): id is MashRestId {
  return typeof id === "string" && (MASH_REST_IDS as readonly string[]).includes(id);
}

/** The mashing plan as an object (an uploaded file's non-object plan reads as empty here; the validator reports it). */
export function mashingOf(recipe: Recipe): Record<string, unknown> {
  return isObject(recipe.mashing) ? recipe.mashing : {};
}

/** The rest ids of a plan first in catalogue order, then whatever else it holds. */
function inPlanOrder(plan: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const id of MASH_REST_IDS) {
    if (id in plan) {
      ordered[id] = plan[id];
    }
  }
  return { ...ordered, ...plan };
}

/**
 * Plans a rest (or, with undefined, drops it) (EDT-032). Without any rest left, the recipe has no "mashing" (EDT-034).
 */
export function withMashRest(recipe: Recipe, id: MashRestId, rest: MashRest | undefined): Recipe {
  const plan = { ...mashingOf(recipe) };
  if (rest === undefined) {
    delete plan[id];
  } else {
    plan[id] = rest;
  }
  const { mashing: _old, ...others } = recipe;
  return Object.keys(plan).length === 0 ? others : { ...others, mashing: inPlanOrder(plan) };
}

/** A new planned rest, with the preset temperature and minutes (EDT-032). */
export function newMashRest(id: MashRestId): MashRest {
  return { temperature: MASH_RESTS[id].tempTypical, minutes: MASH_RESTS[id].minutes };
}

/** Whether a rest's temperature is outside its typical range (EDT-033); only for numbers. */
/** The typical temperature range in the column after the °C field (EDT-031): "60–65 °C". */
export function typicalTemperature(id: MashRestId): string {
  return `${MASH_RESTS[id].tempMin}–${MASH_RESTS[id].tempMax} °C`;
}

export function outsideTypicalRange(id: MashRestId, temperature: unknown): boolean {
  return typeof temperature === "number" && (temperature < MASH_RESTS[id].tempMin || temperature > MASH_RESTS[id].tempMax);
}

/** The two ingredient lists of the Ingredients tab (app RCP-013, EDT-041), in the file's key order. */
export const INGREDIENT_KINDS = ["malts", "hops", "others"] as const;
export type IngredientKind = (typeof INGREDIENT_KINDS)[number];

/** How an ingredient kind is called: the section heading, one entry, the add button. */
export const INGREDIENT_LABELS: Record<IngredientKind, { title: string; one: string }> = {
  malts: { title: "Malt", one: "Malt" },
  hops: { title: "Hops", one: "Hop" },
  others: { title: "Other additions", one: "Other addition" },
};

/** A malt or a hop; a malt may have `ebc`, a hop `alpha` and `minutes` (app RCP-013, Q-39). */
export type Ingredient = {
  name?: unknown;
  grams?: unknown;
  ebc?: unknown;
  alpha?: unknown;
  additions?: unknown;
} & Record<string, unknown>;

/** One time a hop or another addition goes into the boil (app RCP-013, Q-43): its cooking time and amount. */
export type Addition = { minutes?: unknown; grams?: unknown } & Record<string, unknown>;

/** The fields an entry of each list may have besides its name (app RCP-013, Q-43). */
export const INGREDIENT_EXTRA_FIELDS: Record<IngredientKind, readonly string[]> = {
  malts: ["grams", "ebc"],
  hops: ["alpha", "additions"],
  others: ["additions"],
};

/** A hop's or another addition's additions (Q-43); none for a malt or while the list is not a list. */
export function additionsOf(entry: Ingredient): Addition[] {
  return Array.isArray(entry.additions) ? entry.additions.map((a) => (isObject(a) ? a : {})) : [];
}

/** An entry with its additions replaced, in the file's key order (EDT-061). */
export function withAdditions(entry: Ingredient, additions: Addition[]): Ingredient {
  return { ...entry, additions };
}

/**
 * The grams an entry counts with (EDT-043, EDT-061): the sum of a hop's or another addition's valid amounts (an entry
 * with additions never counts a `grams` of its own), or a malt's amount; 0 while there is none.
 */
export function entryGrams(entry: Ingredient): number {
  if (Array.isArray(entry.additions)) {
    return additionsOf(entry).reduce((sum, a) => sum + (validGrams(a.grams) ? a.grams : 0), 0);
  }
  return validGrams(entry.grams) ? entry.grams : 0;
}

/**
 * Moves the amount and cooking time a hop or another addition had of its own (one addition per entry, the shape of
 * version 3 before brewberrypi-app Q-43; never released) into its additions (FMT-003, QE-53): the only addition while
 * it has none, else the first one unless an addition with the same values is there. Nothing is dropped. Returns what
 * changed, one line per entry, for the "Converted" notice.
 */
export function convertSingleAdditions(recipe: Recipe): { recipe: Recipe; changes: string[] } {
  if (!isObject(recipe.ingredients)) {
    return { recipe, changes: [] };
  }
  const changes: string[] = [];
  const ingredients: Record<string, unknown> = { ...recipe.ingredients };
  for (const kind of ["hops", "others"] as const) {
    const list = ingredients[kind];
    if (!Array.isArray(list)) {
      continue;
    }
    ingredients[kind] = list.map((entry, i) => {
      if (!isObject(entry) || (entry.grams === undefined && entry.minutes === undefined)) {
        return entry;
      }
      const { grams, minutes, ...rest } = entry;
      const own: Addition = { ...(minutes !== undefined ? { minutes } : {}), ...(grams !== undefined ? { grams } : {}) };
      const additions = Array.isArray(rest.additions) ? rest.additions : [];
      const known = additions.some((a) => isObject(a) && a.minutes === own.minutes && a.grams === own.grams);
      const label = `${INGREDIENT_LABELS[kind].one.toLowerCase()} ${i + 1}${typeof entry.name === "string" && entry.name ? ` "${entry.name}"` : ""}`;
      changes.push(`${label}: its own amount and cooking time are moved into its additions`);
      return { ...rest, additions: known ? additions : [own, ...additions] };
    });
  }
  return { recipe: { ...recipe, ingredients }, changes };
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The valid values of the new fields (app RCP-013, RCP-014): the same ranges the validator checks. */
export const validEbc = (v: unknown): v is number => finite(v) && v >= 0;
export const validAlpha = (v: unknown): v is number => finite(v) && v >= 0 && v <= 100;
export const validBoilMinutes = (v: unknown): v is number => finite(v) && Number.isInteger(v) && v >= 0;
export const validLiters = (v: unknown): v is number => finite(v) && v > 0;
export const validPlato = (v: unknown): v is number => finite(v) && v >= 0 && v <= 40;

export type BatchField = "liters" | "plato" | "final_plato";

export function batchOf(recipe: Recipe): Record<string, unknown> {
  return isObject(recipe.batch) ? recipe.batch : {};
}

/** The recipe with a batch field set, or removed when `value` is undefined; an empty batch leaves the file (EDT-050). */
export function withBatchField(recipe: Recipe, field: BatchField, value: unknown): Recipe {
  const batch = { ...batchOf(recipe) };
  if (value === undefined) {
    delete batch[field];
  } else {
    batch[field] = value;
  }
  const ordered: Record<string, unknown> = {};
  for (const key of ["liters", "plato", "final_plato"]) {
    if (key in batch) {
      ordered[key] = batch[key];
    }
  }
  const { batch: _old, ...others } = recipe;
  return Object.keys(batch).length === 0 ? others : { ...others, batch: { ...ordered, ...batch } };
}

/** The water volumes of the Water tab (app RCP-015, EDT-051), in the file's key order. */
export const WATER_FIELDS = ["mash", "sparge", "top_up"] as const;
export type WaterField = (typeof WATER_FIELDS)[number];

/** Each water volume's label and what it is for (EDT-051). */
export const WATER_LABELS: Record<WaterField, { label: string; hint: string }> = {
  mash: { label: "Mash water", hint: "Mashed in with the malt (strike water)." },
  sparge: { label: "Sparge water", hint: "Rinses the sugar out of the grain while lautering." },
  top_up: { label: "Top-up water", hint: "Added after lautering, only to dilute to the original gravity." },
};

export const validWater = (v: unknown): v is number => finite(v) && v >= 0;

export function waterOf(recipe: Recipe): Record<string, unknown> {
  return isObject(recipe.water) ? recipe.water : {};
}

/** The recipe with a water volume set, or removed when `value` is undefined; empty water leaves the file (EDT-051). */
/** The fermentation (app RCP-017, EDT-066): the yeast and the target carbonation. */
export function fermentationOf(recipe: Recipe): Record<string, unknown> {
  return isObject(recipe.fermentation) ? recipe.fermentation : {};
}

/** The fermentation's yeast, `{}` while there is none. */
export function yeastOf(recipe: Recipe): Record<string, unknown> {
  const yeast = fermentationOf(recipe).yeast;
  return isObject(yeast) ? yeast : {};
}

/**
 * The recipe with the fermentation's yeast field (`name`, `grams`) or `co2` set, or removed when cleared: an empty
 * yeast is left out, and `fermentation` too while it holds nothing (EDT-066). Kept in the file's order: yeast (name,
 * grams), then co2; any other key as found.
 */
export function withFermentationField(recipe: Recipe, field: "name" | "grams" | "co2", value: unknown): Recipe {
  const { yeast: _yeast, co2: _co2, ...more } = fermentationOf(recipe);
  const yeast: Record<string, unknown> = { ...yeastOf(recipe) };
  let co2 = fermentationOf(recipe).co2;
  if (field === "co2") {
    co2 = value;
  } else if (value === undefined || value === "") {
    delete yeast[field];
  } else {
    yeast[field] = value;
  }
  const { name, grams, ...yeastMore } = yeast;
  const orderedYeast = { ...(name !== undefined ? { name } : {}), ...(grams !== undefined ? { grams } : {}), ...yeastMore };
  const next: Record<string, unknown> = {
    ...(Object.keys(orderedYeast).length > 0 ? { yeast: orderedYeast } : {}),
    ...(co2 !== undefined ? { co2 } : {}),
    ...more,
  };
  const { fermentation: _old, ...others } = recipe;
  return Object.keys(next).length === 0 ? (others as Recipe) : { ...others, fermentation: next };
}

export function withWaterField(recipe: Recipe, field: WaterField, value: unknown): Recipe {
  const water = { ...waterOf(recipe) };
  if (value === undefined) {
    delete water[field];
  } else {
    water[field] = value;
  }
  const ordered: Record<string, unknown> = {};
  for (const key of WATER_FIELDS) {
    if (key in water) {
      ordered[key] = water[key];
    }
  }
  const { water: _old, ...others } = recipe;
  return Object.keys(water).length === 0 ? others : { ...others, water: { ...ordered, ...water } };
}

/** The total water in litres (EDT-052): the sum of the valid volumes; undefined while none is set. */
export function totalWater(recipe: Recipe): number | undefined {
  const water = waterOf(recipe);
  const volumes = WATER_FIELDS.map((f) => water[f]).filter(validWater);
  return volumes.length === 0 ? undefined : volumes.reduce((sum, v) => sum + v, 0);
}

/**
 * The mash thickness in litres per kg of malt (EDT-052): the mash water over the malt weight of the Malt tab; or what
 * is missing.
 */
export function mashThickness(recipe: Recipe): { value: number } | { missing: ("mash" | "malts")[] } {
  const mash = waterOf(recipe).mash;
  const kg = totalGrams(ingredientsOf(recipe, "malts")) / 1000;
  const missing: ("mash" | "malts")[] = [];
  if (!validWater(mash)) {
    missing.push("mash");
  }
  if (kg <= 0) {
    missing.push("malts");
  }
  return missing.length > 0 ? { missing } : { value: (mash as number) / kg };
}

/** The mash water per kg of malt by beer style (EDT-067, QE-58): thin mashes for light beers, thick for strong ones. */
export const MASH_WATER_BY_STYLE = [
  { styles: "Pils, Helles", min: 4, max: 5 },
  { styles: "Weizen, Pale Ale, IPA", min: 3.5, max: 4 },
  { styles: "Märzen, Dunkel, Amber", min: 3, max: 3.5 },
  { styles: "Bock, Stout, strong beers", min: 2.5, max: 3 },
] as const;

/** The rules of thumb of the water estimate (EDT-067): boil-off per hour, grain absorption per kg, other losses. */
export const WATER_RULES = { boilOffPerHour: 0.1, absorptionPerKg: 1, losses: 1, defaultBoilMinutes: 60 } as const;

/** The boil time (EDT-054): the longest cooking time of the boil additions with an amount; undefined while none. */
export function boilMinutesOf(recipe: Recipe): number | undefined {
  const minutes = (["hops", "others"] as const).flatMap((kind) =>
    ingredientsOf(recipe, kind).flatMap((entry) =>
      additionsOf(entry)
        .filter((a) => validGrams(a.grams) && validBoilMinutes(a.minutes))
        .map((a) => a.minutes as number),
    ),
  );
  return minutes.length === 0 ? undefined : Math.max(...minutes);
}

/**
 * The water guide's estimate (EDT-067): the total water as the knockout volume plus the boil-off (10 % of it per hour of
 * boil; the Boil Schedule's boil time, else 60 min), the grain absorption (1 L per kg of malt) and 1 L of other
 * losses; the sparge water as that total minus the mash and top-up water. Or what is missing.
 */
export function waterEstimate(recipe: Recipe):
  | {
      knockout: number;
      boilMinutes: number;
      boilAssumed: boolean;
      boilOff: number;
      absorption: number;
      losses: number;
      total: number;
      /** Undefined while the mash water is not entered. */
      sparge?: number;
    }
  | { missing: ("liters" | "malts")[] } {
  const knockout = batchOf(recipe).liters;
  const kg = totalGrams(ingredientsOf(recipe, "malts")) / 1000;
  const missing: ("liters" | "malts")[] = [];
  if (!validLiters(knockout)) {
    missing.push("liters");
  }
  if (kg <= 0) {
    missing.push("malts");
  }
  if (missing.length > 0) {
    return { missing };
  }
  const liters = knockout as number;
  const boil = boilMinutesOf(recipe);
  const boilMinutes = boil ?? WATER_RULES.defaultBoilMinutes;
  const boilOff = liters * WATER_RULES.boilOffPerHour * (boilMinutes / 60);
  const absorption = kg * WATER_RULES.absorptionPerKg;
  const total = liters + boilOff + absorption + WATER_RULES.losses;
  const { mash, top_up: topUp } = waterOf(recipe);
  const sparge = validWater(mash) ? total - mash - (validWater(topUp) ? topUp : 0) : undefined;
  return { knockout: liters, boilMinutes, boilAssumed: boil === undefined, boilOff, absorption, losses: WATER_RULES.losses, total, sparge };
}

/**
 * The alcohol (EDT-057) from the target original gravity and the final gravity on the Water tab: alcohol by volume
 * and apparent attenuation in percent; or what is missing, or that the final gravity is not below the original.
 */
export function alcoholOf(
  recipe: Recipe,
): { abv: number; attenuation: number } | { missing: ("plato" | "final_plato")[]; notBelow?: undefined } | { notBelow: true; missing?: undefined } {
  const { plato, final_plato: final } = batchOf(recipe);
  const missing = (["plato", "final_plato"] as const).filter((f) => !validPlato(f === "plato" ? plato : final));
  if (missing.length > 0) {
    return { missing: [...missing] };
  }
  if ((final as number) >= (plato as number)) {
    return { notBelow: true };
  }
  return { abv: alcoholByVolume(plato as number, final as number), attenuation: apparentAttenuation(plato as number, final as number) };
}

/**
 * A figure computed from the tables (EDT-048, EDT-049), or why it can't be yet: no entries with an amount, rows
 * (numbered from 1) missing a value, or a batch field missing.
 */
export type Figure =
  | { value: number; noEntries?: undefined; rows?: undefined; batch?: undefined }
  | { value?: undefined; noEntries?: true; rows?: number[]; batch?: BatchField[] };

/** The beer colour in EBC (EDT-048): every malt with an amount needs its EBC, and the batch needs its volume. */
export function beerColourOf(recipe: Recipe): Figure {
  const malts = ingredientsOf(recipe, "malts");
  const counted = malts.map((m, i) => ({ m, i })).filter(({ m }) => validGrams(m.grams));
  if (counted.length === 0) {
    return { noEntries: true };
  }
  const rows = counted.filter(({ m }) => !validEbc(m.ebc)).map(({ i }) => i + 1);
  const liters = batchOf(recipe).liters;
  const batch: BatchField[] = validLiters(liters) ? [] : ["liters"];
  if (rows.length > 0 || batch.length > 0) {
    return { rows, batch };
  }
  return { value: beerColourEbc(counted.map(({ m }) => ({ grams: m.grams as number, ebc: m.ebc as number })), liters as number) };
}

/** The bitterness in IBU (EDT-049): every hop with an amount needs alpha and boil time, the batch volume and gravity. */
export function bitternessOf(recipe: Recipe): Figure {
  const hops = ingredientsOf(recipe, "hops");
  // Every addition with an amount counts (Q-43): it needs its hop's alpha acid and its own cooking time.
  const counted = hops
    .map((h, i) => ({ h, i, additions: additionsOf(h).filter((a) => validGrams(a.grams)) }))
    .filter(({ additions }) => additions.length > 0);
  if (counted.length === 0) {
    return { noEntries: true };
  }
  const rows = counted
    .filter(({ h, additions }) => !validAlpha(h.alpha) || additions.some((a) => !validBoilMinutes(a.minutes)))
    .map(({ i }) => i + 1);
  const { liters, plato } = batchOf(recipe);
  const batch = (["liters", "plato"] as const).filter((f) => !(f === "liters" ? validLiters(liters) : validPlato(plato)));
  if (rows.length > 0 || batch.length > 0) {
    return { rows, batch: [...batch] };
  }
  const values = counted.flatMap(({ h, additions }) =>
    additions.map((a) => ({ grams: a.grams as number, alpha: h.alpha as number, minutes: a.minutes as number })),
  );
  return { value: bitternessIbu(values, liters as number, plato as number) };
}

export function ingredientsOf(recipe: Recipe, kind: IngredientKind): Ingredient[] {
  const list = isObject(recipe.ingredients) ? recipe.ingredients[kind] : undefined;
  return Array.isArray(list) ? list.map((entry) => (isObject(entry) ? entry : {})) : [];
}

/**
 * The recipe with `kind`'s list replaced (EDT-042): an empty list is left out of the file, and so is `ingredients`
 * when nothing is left in it. Other keys of `ingredients` are kept (they are reported, FMT-004).
 */
export function withIngredients(recipe: Recipe, kind: IngredientKind, list: Ingredient[]): Recipe {
  const current = isObject(recipe.ingredients) ? { ...recipe.ingredients } : {};
  if (list.length === 0) {
    delete current[kind];
  } else {
    current[kind] = list;
  }
  const ordered: Record<string, unknown> = {};
  for (const k of INGREDIENT_KINDS) {
    if (k in current) {
      ordered[k] = current[k];
    }
  }
  const ingredients = { ...ordered, ...current };
  const { ingredients: _old, ...others } = recipe;
  return Object.keys(ingredients).length === 0 ? others : { ...others, ingredients };
}

/** A whole number of grams of at least 1 (app RCP-013): only such amounts count towards the total. */
export function validGrams(grams: unknown): grams is number {
  return typeof grams === "number" && Number.isInteger(grams) && grams >= 1;
}

/** The total weight of a list (EDT-043): the sum of its valid amounts, in grams. */
export function totalGrams(list: Ingredient[]): number {
  return list.reduce((sum, entry) => sum + entryGrams(entry), 0);
}

/** An entry's share of the list's total weight, in percent (EDT-043); undefined while its amount is not valid. */
export function shareOf(entry: Ingredient, list: Ingredient[]): number | undefined {
  const total = totalGrams(list);
  const grams = entryGrams(entry);
  return grams > 0 && total > 0 ? (grams / total) * 100 : undefined;
}

/** A share as text, rounded to one decimal: "90 %", "33.3 %" (EDT-043). */
export function formatShare(percent: number): string {
  return `${Math.round(percent * 10) / 10} %`;
}

export function goalsOf(recipe: Recipe): Goal[] {
  return recipe.mashing_process.goals;
}

export function withGoals(recipe: Recipe, goals: Goal[]): Recipe {
  return { ...recipe, mashing_process: { ...recipe.mashing_process, goals } };
}

export interface GoalInfo {
  /** Display name in the app (spec 04, table 4.1). */
  label: string;
  /** What the goal does, in a few words, for the editor. */
  summary: string;
  required: GoalField[];
  optional: GoalField[];
}

export const GOAL_INFO: Record<GoalType, GoalInfo> = {
  PourInBrewingWater: {
    label: "Add Water",
    summary: "Asks the brewer to pour in the brewing water.",
    required: [],
    optional: [],
  },
  HeatUp: { label: "Heat Up", summary: "Heats the mash to the temperature.", required: ["temperature"], optional: [] },
  MashIn: { label: "Mash In", summary: "Asks the brewer to mash in the malt.", required: [], optional: [] },
  Rest: {
    label: "Rest",
    summary: "Holds the temperature for the minutes. Name and description: both or neither.",
    required: ["temperature", "minutes"],
    optional: ["name", "description"],
  },
  IodineTest: {
    label: "Iodine Test",
    summary: "Holds the temperature and asks for the iodine test; on No, rests the minutes and asks again.",
    required: ["temperature", "minutes"],
    optional: [],
  },
  Lautering: { label: "Lautering", summary: "Switches everything off and asks the brewer to lauter.", required: [], optional: [] },
  HeatUpForHopsCooking: {
    label: "Heat Up (hops cooking)",
    summary: "Heats at full power to 97 °C.",
    required: [],
    optional: [],
  },
  CookWater: {
    label: "Cook",
    summary: "Cooks at 100 °C for the minutes, with its own name and description.",
    required: ["name", "description", "minutes"],
    optional: [],
  },
};

export const FIELD_LABELS: Record<GoalField, string> = {
  temperature: "Temperature",
  minutes: "Duration",
  name: "Name",
  description: "Description",
};

/** One part of a goal's line (EDT-011): the type, a joining word, a value, a missing value, or the goal's name. */
export interface LinePart {
  kind: "type" | "word" | "value" | "missing" | "name";
  text: string;
}

/**
 * A goal as one short sentence (QE-26): "Heat Up to 62 °C", "Rest at 65 °C for 30 min — Maltoserast". Display names
 * only (QE-24); a missing value reads "?", a value that is not a number is shown as typed (both "missing").
 */
export function goalLine(goal: Goal): LinePart[] {
  if (!isGoalType(goal.type)) {
    const text = typeof goal.type === "string" && goal.type ? `Unknown: ${goal.type}` : "Choose a type";
    return [{ kind: "missing", text }];
  }
  const fields = goalFields(goal.type);
  const parts: LinePart[] = [{ kind: "type", text: GOAL_INFO[goal.type].label }];
  const value = (v: unknown, unit: string): LinePart =>
    typeof v === "number" ? { kind: "value", text: `${v} ${unit}` } : { kind: "missing", text: `${typeof v === "string" && v ? v : "?"} ${unit}` };
  if (fields.includes("temperature")) {
    parts.push({ kind: "word", text: goal.type === "HeatUp" ? "to" : "at" }, value(goal.temperature, "°C"));
  }
  if (fields.includes("minutes")) {
    parts.push({ kind: "word", text: "for" }, value(goal.minutes, "min"));
  }
  if (typeof goal.name === "string" && goal.name.trim()) {
    parts.push({ kind: "word", text: "—" }, { kind: "name", text: goal.name });
  }
  return parts;
}

export function isGoalType(type: unknown): type is GoalType {
  return typeof type === "string" && (GOAL_TYPES as readonly string[]).includes(type);
}

/** The fields a goal type takes, in file order. */
export function goalFields(type: string): GoalField[] {
  if (!isGoalType(type)) {
    return [];
  }
  const info = GOAL_INFO[type];
  const order: GoalField[] = ["temperature", "minutes", "name", "description"];
  return order.filter((f) => info.required.includes(f) || info.optional.includes(f));
}

/** A new goal of the type, with the required numbers preset so it is valid where it can be. */
export function newGoal(type: GoalType): Goal {
  switch (type) {
    case "HeatUp":
      return { type, temperature: 62 };
    case "Rest":
    case "IodineTest":
      return { type, temperature: 62, minutes: 10 };
    case "CookWater":
      return { type, name: "", description: "", minutes: 60 };
    default:
      return { type };
  }
}

/** Changes a goal's type, keeping the values the new type also takes. */
export function changeGoalType(goal: Goal, type: GoalType): Goal {
  const fresh = newGoal(type);
  for (const field of goalFields(type)) {
    if (goal[field] !== undefined) {
      fresh[field] = goal[field];
    }
  }
  return fresh;
}

/** A new, empty recipe: the brewer fills in name and goals. */
export function emptyRecipe(): Recipe {
  return { version: FORMAT_VERSION, name: "", mashing_process: { goals: [] } };
}

export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Turns an uploaded file name into a recipe id: "Weizen.json" -> "Weizen". */
export function idFromFileName(fileName: string): string {
  return fileName.replace(/\.json$/i, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toGoal(value: unknown): Goal {
  return isObject(value) ? ({ ...value, type: String(value.type ?? "") } as Goal) : ({ type: "" } as Goal);
}

export interface ReadRecipe {
  /** The editable recipe; undefined when the file can't be edited here (newer format version). */
  recipe?: Recipe;
  /** What the editor changed to bring the file into the current format; saving or downloading writes it so. */
  converted?: string;
  /** Why the file can't be edited. */
  error?: string;
}

/**
 * Makes an editable recipe of parsed JSON, in the current format version. Keeps everything else the file had, so the
 * validator can point at what is wrong; only the shape the editor needs is enforced. Files in the old format (goals
 * at the top level, before brewberrypi-app Q-31) are converted; files of a newer format version are refused, so
 * nothing the editor doesn't know is lost.
 */
export function readRecipe(json: unknown): ReadRecipe {
  const source = isObject(json) ? json : {};
  const changes: string[] = [];
  const { $schema: _schema, version, goals: flatGoals, mashing_process: mashing, ...rest } = source;
  if (typeof version === "number" && Number.isInteger(version) && version > FORMAT_VERSION) {
    return {
      error:
        `This recipe file is in format version ${version}; this editor knows version ${FORMAT_VERSION}. ` +
        "It was written for a newer BrewberryPi app. Reload the editor to get the latest version.",
    };
  }
  // Versions 1 (or none) and 2 differ from version 3 only in what they don't allow yet (empty goals, the mashing
  // plan; app migrators 1 → 2 → 3): written as version 3 as they are.
  if (version !== undefined && version !== 1 && version !== 2 && version !== FORMAT_VERSION) {
    changes.push(`its format version ${JSON.stringify(version)} is not valid; it is written as version ${FORMAT_VERSION}`);
  }
  let process: MashingProcess;
  if (isObject(mashing)) {
    process = { ...mashing, goals: Array.isArray(mashing.goals) ? mashing.goals.map(toGoal) : [] };
    if (flatGoals !== undefined) {
      rest.goals = flatGoals;
    }
  } else if (Array.isArray(flatGoals)) {
    process = { goals: flatGoals.map(toGoal) };
    changes.push('it was in the old format; its goals are moved into "mashing_process"');
  } else {
    process = { goals: [] };
    if (flatGoals !== undefined) {
      rest.goals = flatGoals;
    }
  }
  const converted = convertSingleAdditions({
    version: FORMAT_VERSION,
    ...rest,
    name: typeof source.name === "string" ? source.name : "",
    mashing_process: process,
  } as Recipe);
  const recipe = converted.recipe;
  changes.push(...converted.changes);
  return { recipe, converted: changes.length > 0 ? `Converted: ${changes.join("; ")}.` : undefined };
}

/** The recipe with its description (EDT-065, app RCP-016): an empty one is left out of the file. */
export function withDescription(recipe: Recipe, text: string): Recipe {
  const { description: _old, ...rest } = recipe;
  return text === "" ? (rest as Recipe) : { ...rest, description: text };
}

/** readRecipe for recipes known to be in the current format (samples, tests). */
export function toRecipe(json: unknown): Recipe {
  return readRecipe(json).recipe ?? emptyRecipe();
}

/** A value on one line, objects and lists with spaces inside their brackets: `{ "a": 1, "b": [ 2 ] }`. */
function oneLine(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[ ${value.map(oneLine).join(", ")} ]`;
  }
  if (isObject(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return entries.length === 0 ? "{}" : `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${oneLine(v)}`).join(", ")} }`;
  }
  return JSON.stringify(value);
}

const indentGoal = (goal: Goal) =>
  `{ ${Object.entries(goal)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ")} }`;

/**
 * An ingredient on one line (FMT-006): its fields in order, its additions inline, each `minutes` before `grams`:
 * `{ "name": "Hallertauer", "alpha": 12, "additions": [ { "minutes": 60, "grams": 20 } ] }`.
 */
function formatEntry(entry: Record<string, unknown>): string {
  // Known fields in the file's order (name, grams, ebc, alpha, additions), then any other, as found.
  const order = ["name", "grams", "ebc", "alpha", "additions"];
  const known = order.filter((k) => k in entry).map((k) => [k, entry[k]] as const);
  const fields = [...known, ...Object.entries(entry).filter(([k]) => !order.includes(k))]
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (k === "additions" && Array.isArray(v)) {
        const items = v.map((a) => {
          if (!isObject(a)) {
            return JSON.stringify(a);
          }
          const { minutes, grams, ...rest } = a;
          return indentGoal({ minutes, grams, ...rest } as unknown as Goal);
        });
        return `${JSON.stringify(k)}: [${items.length ? ` ${items.join(", ")} ` : ""}]`;
      }
      return `${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    });
  return `{ ${fields.join(", ")} }`;
}

/**
 * The file content, formatted like the app's shipped recipes: "version" first (RCP-008), one line per goal, then the
 * mashing plan, one line per rest in catalogue order, then the ingredients, one line per malt and hop, then the
 * batch and the water, each on one line (FMT-006). The editor does not write "$schema" (optional,
 * ignored by the app).
 */
export function serializeRecipe(recipe: Recipe): string {
  const { $schema: _schema, version, name, description, mashing_process: process, mashing, ingredients, batch, water, fermentation, ...rest } =
    recipe;
  const { goals, ...processRest } = process;
  const lines: string[] = [];
  if (version !== undefined) {
    lines.push(`  "version": ${JSON.stringify(version)},`);
  }
  lines.push(`  "name": ${JSON.stringify(name)},`);
  // The description after the name (FMT-006), on one line: its line breaks as \n.
  if (description !== undefined) {
    lines.push(`  "description": ${JSON.stringify(description)},`);
  }
  const processLines: string[] = [];
  if (goals.length === 0) {
    processLines.push(`    "goals": []`);
  } else {
    processLines.push(`    "goals": [`);
    goals.forEach((goal, i) => processLines.push(`      ${indentGoal(goal)}${i < goals.length - 1 ? "," : ""}`));
    processLines.push(`    ]`);
  }
  for (const [key, value] of Object.entries(processRest)) {
    processLines[processLines.length - 1] += ",";
    processLines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  lines.push(`  "mashing_process": {`, ...processLines, `  }`);
  if (isObject(mashing)) {
    const entries = Object.entries(inPlanOrder(mashing));
    if (entries.length === 0) {
      lines[lines.length - 1] += ",";
      lines.push(`  "mashing": {}`);
    } else {
      lines[lines.length - 1] += ",";
      lines.push(`  "mashing": {`);
      entries.forEach(([id, value], i) => {
        const text = isObject(value) ? indentGoal(value as Goal) : JSON.stringify(value);
        lines.push(`    ${JSON.stringify(id)}: ${text}${i < entries.length - 1 ? "," : ""}`);
      });
      lines.push(`  }`);
    }
  } else if (mashing !== undefined) {
    lines[lines.length - 1] += ",";
    lines.push(`  "mashing": ${JSON.stringify(mashing)}`);
  }
  if (isObject(ingredients) && Object.keys(ingredients).length > 0) {
    // One line per malt and hop, in the brewer's order (FMT-006).
    lines[lines.length - 1] += ",";
    lines.push(`  "ingredients": {`);
    const keys = Object.keys(ingredients);
    keys.forEach((key, k) => {
      const value = ingredients[key];
      const comma = k < keys.length - 1 ? "," : "";
      if (Array.isArray(value) && value.length > 0) {
        lines.push(`    ${JSON.stringify(key)}: [`);
        value.forEach((entry, i) => {
          const text = isObject(entry) ? formatEntry(entry) : JSON.stringify(entry);
          lines.push(`      ${text}${i < value.length - 1 ? "," : ""}`);
        });
        lines.push(`    ]${comma}`);
      } else {
        lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`);
      }
    });
    lines.push(`  }`);
  } else if (ingredients !== undefined) {
    lines[lines.length - 1] += ",";
    lines.push(`  "ingredients": ${JSON.stringify(ingredients)}`);
  }
  if (batch !== undefined) {
    // One line: { "liters": 20, "plato": 12.6 } (FMT-006).
    lines[lines.length - 1] += ",";
    const one = isObject(batch) && Object.keys(batch).length > 0 ? indentGoal(batch as Goal) : JSON.stringify(batch);
    lines.push(`  "batch": ${one}`);
  }
  if (water !== undefined) {
    // One line: { "mash": 16, "sparge": 14, "top_up": 2 } (FMT-006).
    lines[lines.length - 1] += ",";
    const one = isObject(water) && Object.keys(water).length > 0 ? indentGoal(water as Goal) : JSON.stringify(water);
    lines.push(`  "water": ${one}`);
  }
  if (fermentation !== undefined) {
    // One line: { "yeast": { "name": "WB-06", "grams": 11.5 }, "co2": 6.5 } (FMT-006).
    lines[lines.length - 1] += ",";
    lines.push(`  "fermentation": ${oneLine(fermentation)}`);
  }
  for (const [key, value] of Object.entries(rest)) {
    lines[lines.length - 1] += ",";
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  return `{\n${lines.join("\n")}\n}\n`;
}
