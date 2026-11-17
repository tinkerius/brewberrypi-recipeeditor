/**
 * Recipe and goal types: the recipe file format of brewberrypi-app (data/recipe.schema.json, spec 04 and 07 §7.2):
 * { "version": 3, "name": …, "description": …, "mashing_process": { "goals": […] }, "mashing": { "malts", "rests" },
 * "boiling": { "whirlpool", "hops", "others" }, "water": { …, "target_knockout_volume", "treatment" },
 * "fermentation": { "original_gravity", "final_gravity", "yeast", "co2" } }, one recipe per file, the file name is
 * the id. The goals may be empty (app Q-34): the app then lists the recipe but can't load it. The other sections are
 * design information (app Q-37..Q-51) the app doesn't use; "mashing.rests" is the mashing plan, keyed by rest id.
 */

import { alcoholByVolume, apparentAttenuation, beerColourEbc, bitternessIbu } from "./brewMath";
import { IODINE_TEST, MASH_IN, MASH_PLAN_ORDER, MASH_REST_IDS, bandInfo, type MashBandId, type MashRestId } from "./mashRests";

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
  /** The malts and the mashing plan `rests` (app RCP-012, Q-51); absent while there are neither. */
  mashing?: unknown;
  /** The whirlpool, the hops and the other additions (app RCP-018, Q-51); absent while there are none. */
  boiling?: unknown;
  /** The brewing-day water in litres and the target knockout volume (app RCP-015); absent while none is set. */
  water?: unknown;
  /** The gravities, the yeast and the target carbonation (app RCP-017); absent while none is set. */
  fermentation?: unknown;
  [key: string]: unknown;
}

/** A planned rest as it is edited: temperature and minutes, plus whatever an uploaded file contained. */
export type MashRest = { temperature?: unknown; minutes?: unknown } & Record<string, unknown>;

export function isMashRestId(id: unknown): id is MashRestId {
  return typeof id === "string" && (MASH_REST_IDS as readonly string[]).includes(id);
}

/**
 * The keys of the design sections in the file's order (FMT-006, app Q-51); any other key follows, as found.
 */
export const SECTION_ORDER = {
  mashing: ["malts", "rests"],
  boiling: ["whirlpool", "hops", "others"],
  water: ["mash", "sparge", "top_up", "target_knockout_volume", "treatment"],
  fermentation: ["original_gravity", "final_gravity", "yeast", "co2"],
} as const;
export type Section = keyof typeof SECTION_ORDER;

/** An object's keys in this order, then any other key as found; undefined values are left out. */
function inOrder(value: Record<string, unknown>, order: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of [...order, ...Object.keys(value)]) {
    if (value[key] !== undefined && !(key in result)) {
      result[key] = value[key];
    }
  }
  return result;
}

/** A design section as an object (an uploaded file's non-object section reads as empty here; the validator reports it). */
export function sectionOf(recipe: Recipe, section: Section): Record<string, unknown> {
  const value = recipe[section];
  return isObject(value) ? value : {};
}

/**
 * The recipe with a field of a design section set, or removed when `value` is undefined; an empty section leaves the
 * file. Kept in the file's order (SECTION_ORDER); any other key as found.
 */
export function withSectionField(recipe: Recipe, section: Section, field: string, value: unknown): Recipe {
  const next = { ...sectionOf(recipe, section), [field]: value };
  if (value === undefined) {
    delete next[field];
  }
  const { [section]: _old, ...others } = recipe;
  return Object.keys(next).length === 0 ? (others as Recipe) : ({ ...others, [section]: inOrder(next, SECTION_ORDER[section]) } as Recipe);
}

/**
 * The mashing plan `mashing.rests` as an object (an uploaded file's non-object plan reads as empty here; the validator
 * reports it).
 */
export function restsOf(recipe: Recipe): Record<string, unknown> {
  const rests = sectionOf(recipe, "mashing").rests;
  return isObject(rests) ? rests : {};
}

/** The recipe with its mashing plan replaced: without any rest, `rests` leaves `mashing`, and so does `mashing` (EDT-034). */
function withRests(recipe: Recipe, plan: Record<string, unknown>): Recipe {
  return withSectionField(recipe, "mashing", "rests", Object.keys(plan).length === 0 ? undefined : inPlanOrder(plan));
}

/** The plan's entries in the table's order (the mash-in first, the iodine test before the mash-out), then whatever else it holds. */
function inPlanOrder(plan: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const id of MASH_PLAN_ORDER) {
    if (id in plan) {
      ordered[id] = plan[id];
    }
  }
  return { ...ordered, ...plan };
}

/**
 * Plans a rest (or, with undefined, drops it) (EDT-032). Without any rest left, the recipe has no "mashing.rests"
 * (EDT-034).
 */
export function withMashRest(recipe: Recipe, id: MashRestId, rest: MashRest | undefined): Recipe {
  const plan = { ...restsOf(recipe) };
  if (rest === undefined) {
    delete plan[id];
  } else {
    plan[id] = rest;
  }
  return withRests(recipe, plan);
}

/**
 * Sets the mash-in temperature (EDT-031, QE-77); undefined (an emptied field) drops the mash-in. Without anything
 * left, the recipe has no "mashing.rests" (EDT-034).
 */
export function withMashIn(recipe: Recipe, temperature: unknown): Recipe {
  const plan = { ...restsOf(recipe) };
  if (temperature === undefined) {
    delete plan[MASH_IN];
  } else {
    plan[MASH_IN] = { ...(isObject(plan[MASH_IN]) ? plan[MASH_IN] : {}), temperature };
  }
  return withRests(recipe, plan);
}

/** Plans the iodine test (a marker, `{}`) or drops it (EDT-031, QE-79). */
export function withIodineTest(recipe: Recipe, planned: boolean): Recipe {
  const plan = { ...restsOf(recipe) };
  if (planned) {
    plan[IODINE_TEST] = {};
  } else {
    delete plan[IODINE_TEST];
  }
  return withRests(recipe, plan);
}

/** The mash-in temperature where the schedule starts (EDT-039): only a valid one (0–110 °C). */
export function mashInTemperature(plan: Record<string, unknown>): number | undefined {
  const mashIn = plan[MASH_IN];
  const temperature = isObject(mashIn) ? mashIn.temperature : undefined;
  return typeof temperature === "number" && Number.isFinite(temperature) && temperature >= 0 && temperature <= 110 ? temperature : undefined;
}

/** A newly ticked rest (EDT-032): no preset (QE-63), its temperature and minutes are entered; until then problems. */
export function newMashRest(_id: MashRestId): MashRest {
  return {};
}

/** Whether a rest's temperature is outside its typical range (EDT-033); only for numbers. */
/** The typical temperature range in the column after the °C field (EDT-031): "60–65 °C". */
export function typicalTemperature(id: MashBandId): string {
  return `${bandInfo(id).tempMin}–${bandInfo(id).tempMax} °C`;
}

export function outsideTypicalRange(id: MashBandId, temperature: unknown): boolean {
  return typeof temperature === "number" && (temperature < bandInfo(id).tempMin || temperature > bandInfo(id).tempMax);
}

/** The ingredient lists of the Malt and Boiling tabs (app RCP-013, EDT-041). */
export const INGREDIENT_KINDS = ["malts", "hops", "others"] as const;
export type IngredientKind = (typeof INGREDIENT_KINDS)[number];

/** The section each list is in (app Q-51): the malts in `mashing`, the hops and other additions in `boiling`. */
export const INGREDIENT_SECTIONS: Record<IngredientKind, Section> = { malts: "mashing", hops: "boiling", others: "boiling" };

/** Each list's path in the file, as the validator reports it (app Q-51). */
export const INGREDIENT_PATHS: Record<IngredientKind, string> = {
  malts: "mashing.malts",
  hops: "boiling.hops",
  others: "boiling.others",
};

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
  if (!isObject(recipe.boiling)) {
    return { recipe, changes: [] };
  }
  const changes: string[] = [];
  const boiling: Record<string, unknown> = { ...recipe.boiling };
  for (const kind of ["hops", "others"] as const) {
    const list = boiling[kind];
    if (!Array.isArray(list)) {
      continue;
    }
    boiling[kind] = list.map((entry, i) => {
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
  return { recipe: { ...recipe, boiling }, changes };
}

/**
 * Moves the sections of an earlier draft of version 3 (before brewberrypi-app Q-51; never released) to their places
 * (FMT-003): `ingredients.malts` to `mashing.malts`, the rests directly in `mashing` to `mashing.rests`,
 * `ingredients.hops` and `others` and `boil.whirlpool` to `boiling`, `batch.liters` to `water.target_knockout_volume`,
 * `batch.plato` and `final_plato` to `fermentation.original_gravity` and `final_gravity`. A value is moved only where
 * its new place is free and the old section is an object; whatever can't be moved stays where it was (the validator
 * reports it), so nothing is dropped. Returns what changed, for the "Converted" notice.
 */
export function convertDraftSections(recipe: Recipe): { recipe: Recipe; changes: string[] } {
  const changes: string[] = [];
  let next: Recipe = { ...recipe };
  const move = (from: string, key: string, section: Section, field: string, what: string): void => {
    const source = next[from];
    if (!isObject(source) || !(key in source) || field in sectionOf(next, section)) {
      return;
    }
    const { [key]: value, ...rest } = source;
    next = withSectionField(next, section, field, value);
    if (Object.keys(rest).length === 0) {
      delete next[from];
    } else {
      next[from] = rest;
    }
    changes.push(what);
  };
  // The rests directly in `mashing` (no `malts` or `rests` there yet): the mashing plan.
  const mashing = next.mashing;
  if (isObject(mashing) && Object.keys(mashing).length > 0 && Object.keys(mashing).every((k) => MASH_PLAN_ORDER.includes(k))) {
    next = { ...next, mashing: { rests: mashing } };
    changes.push('its mashing plan is moved into "mashing.rests"');
  }
  move("ingredients", "malts", "mashing", "malts", 'its malts are moved into "mashing"');
  move("ingredients", "hops", "boiling", "hops", 'its hops are moved into "boiling"');
  move("ingredients", "others", "boiling", "others", 'its other additions are moved into "boiling"');
  move("boil", "whirlpool", "boiling", "whirlpool", 'its whirlpool is moved into "boiling"');
  move("batch", "liters", "water", "target_knockout_volume", 'its knockout volume is moved into "water"');
  move("batch", "plato", "fermentation", "original_gravity", 'its original gravity is moved into "fermentation"');
  move("batch", "final_plato", "fermentation", "final_gravity", 'its final gravity is moved into "fermentation"');
  for (const from of ["ingredients", "boil", "batch"]) {
    if (isObject(next[from]) && Object.keys(next[from]).length === 0) {
      delete next[from];
    }
  }
  return { recipe: next, changes };
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The valid values of the design fields (app RCP-013, RCP-014): the same ranges the validator checks. */
export const validEbc = (v: unknown): v is number => finite(v) && v >= 0;
export const validAlpha = (v: unknown): v is number => finite(v) && v >= 0 && v <= 100;
export const validBoilMinutes = (v: unknown): v is number => finite(v) && Number.isInteger(v) && v >= 0;
export const validLiters = (v: unknown): v is number => finite(v) && v > 0;
export const validPlato = (v: unknown): v is number => finite(v) && v >= 0 && v <= 40;

/**
 * The figures of the brew the recipe is for (app RCP-014, Q-51): the target knockout volume in `water`, the target
 * original gravity and the final gravity in `fermentation`.
 */
export type BatchField = "target_knockout_volume" | "original_gravity" | "final_gravity";

/** The section each batch figure is in (app Q-51). */
export const BATCH_SECTIONS: Record<BatchField, Section> = {
  target_knockout_volume: "water",
  original_gravity: "fermentation",
  final_gravity: "fermentation",
};

/** The batch figures as they are in the file (each may be missing or invalid). */
export function batchOf(recipe: Recipe): Partial<Record<BatchField, unknown>> {
  const water = sectionOf(recipe, "water");
  const fermentation = sectionOf(recipe, "fermentation");
  return {
    target_knockout_volume: water.target_knockout_volume,
    original_gravity: fermentation.original_gravity,
    final_gravity: fermentation.final_gravity,
  };
}

/** The recipe with a batch figure set, or removed when `value` is undefined; an empty section leaves the file (EDT-050). */
export function withBatchField(recipe: Recipe, field: BatchField, value: unknown): Recipe {
  return withSectionField(recipe, BATCH_SECTIONS[field], field, value);
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
  return sectionOf(recipe, "water");
}

/** Whether the brewer does a whirlpool after the boil (app RCP-018, EDT-075). */
export function whirlpoolOf(recipe: Recipe): boolean {
  return sectionOf(recipe, "boiling").whirlpool === true;
}

/**
 * The recipe with the whirlpool ticked or not (EDT-075): ticked, `boiling.whirlpool` is true; unticked, it is left
 * out, and `boiling` too while it holds nothing. The hops and other additions are kept.
 */
export function withWhirlpool(recipe: Recipe, on: boolean): Recipe {
  return withSectionField(recipe, "boiling", "whirlpool", on ? true : undefined);
}

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
 * yeast is left out, and `fermentation` too while it holds nothing (EDT-066). Kept in the file's order: the
 * gravities, the yeast (name, grams), then co2; any other key as found.
 */
export function withFermentationField(recipe: Recipe, field: "name" | "grams" | "co2", value: unknown): Recipe {
  if (field === "co2") {
    return withSectionField(recipe, "fermentation", "co2", value);
  }
  const yeast: Record<string, unknown> = { ...yeastOf(recipe) };
  if (value === undefined || value === "") {
    delete yeast[field];
  } else {
    yeast[field] = value;
  }
  const ordered = inOrder(yeast, ["name", "grams"]);
  return withSectionField(recipe, "fermentation", "yeast", Object.keys(ordered).length > 0 ? ordered : undefined);
}

/** The recipe with a water volume set, or removed when `value` is undefined; empty water leaves the file (EDT-051). */
export function withWaterField(recipe: Recipe, field: WaterField, value: unknown): Recipe {
  return withSectionField(recipe, "water", field, value);
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
  const kg = totalGrams(maltsWithAcidMalt(recipe)) / 1000;
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
  { styles: "Pils, Helles", short: "Pils, Helles", min: 4, max: 5 },
  { styles: "Weizen, Pale Ale, IPA", short: "Weizen, IPA", min: 3.5, max: 4 },
  { styles: "Märzen, Dunkel, Amber", short: "Märzen, Dunkel", min: 3, max: 3.5 },
  { styles: "Bock, Stout, strong beers", short: "Bock, Stout", min: 2.5, max: 3 },
] as const;

/** The styles of EDT-067 whose mash water range holds a mash thickness, rounded to one decimal (EDT-073). */
export function stylesOfMashThickness(value: number): string[] {
  const rounded = Math.round(value * 10) / 10;
  return MASH_WATER_BY_STYLE.filter((s) => s.min <= rounded && rounded <= s.max).map((s) => s.styles);
}

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
  | { missing: ("target_knockout_volume" | "malts")[] } {
  const knockout = batchOf(recipe).target_knockout_volume;
  const kg = totalGrams(maltsWithAcidMalt(recipe)) / 1000;
  const missing: ("target_knockout_volume" | "malts")[] = [];
  if (!validLiters(knockout)) {
    missing.push("target_knockout_volume");
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
): { abv: number; attenuation: number } | { missing: ("original_gravity" | "final_gravity")[]; notBelow?: undefined } | { notBelow: true; missing?: undefined } {
  const { original_gravity: plato, final_gravity: final } = batchOf(recipe);
  const missing = (["original_gravity", "final_gravity"] as const).filter((f) => !validPlato(f === "original_gravity" ? plato : final));
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
  const malts = maltsWithAcidMalt(recipe);
  const counted = malts.map((m, i) => ({ m, i })).filter(({ m }) => validGrams(m.grams));
  if (counted.length === 0) {
    return { noEntries: true };
  }
  const rows = counted.filter(({ m }) => !validEbc(m.ebc)).map(({ i }) => i + 1);
  const liters = batchOf(recipe).target_knockout_volume;
  const batch: BatchField[] = validLiters(liters) ? [] : ["target_knockout_volume"];
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
  const { target_knockout_volume: liters, original_gravity: plato } = batchOf(recipe);
  const batch = (["target_knockout_volume", "original_gravity"] as const).filter((f) =>
    !(f === "target_knockout_volume" ? validLiters(liters) : validPlato(plato)),
  );
  if (rows.length > 0 || batch.length > 0) {
    return { rows, batch: [...batch] };
  }
  const values = counted.flatMap(({ h, additions }) =>
    additions.map((a) => ({ grams: a.grams as number, alpha: h.alpha as number, minutes: a.minutes as number })),
  );
  return { value: bitternessIbu(values, liters as number, plato as number) };
}

/** A list of ingredients (app RCP-013): the malts from `mashing`, the hops and other additions from `boiling` (Q-51). */
export function ingredientsOf(recipe: Recipe, kind: IngredientKind): Ingredient[] {
  const list = sectionOf(recipe, INGREDIENT_SECTIONS[kind])[kind];
  return Array.isArray(list) ? list.map((entry) => (isObject(entry) ? entry : {})) : [];
}

/**
 * The recipe with `kind`'s list replaced (EDT-042): an empty list is left out of the file, and so is its section when
 * nothing is left in it. Other keys of the section are kept (the mashing plan, the whirlpool, or what the validator
 * reports, FMT-004).
 */
export function withIngredients(recipe: Recipe, kind: IngredientKind, list: Ingredient[]): Recipe {
  return withSectionField(recipe, INGREDIENT_SECTIONS[kind], kind, list.length === 0 ? undefined : list);
}

/** A whole number of grams of at least 1 (app RCP-013): only such amounts count towards the total. */
export function validGrams(grams: unknown): grams is number {
  return typeof grams === "number" && Number.isInteger(grams) && grams >= 1;
}

/** The total weight of a list (EDT-043): the sum of its valid amounts, in grams. */
/** The acid malt of the water treatment as shown on the Malt tab (EDT-070, QE-67): never stored, about 5 EBC. */
export const ACID_MALT = { name: "Acid malt", ebc: 5 } as const;

/**
 * The acid malt in grams (EDT-069, EDT-070): its share (`water.treatment.acid_malt`) is of the total malt, the acid
 * malt included, so it is % ÷ (100 − %) × the Malt tab's malts (1 % with 4.6 kg: 46.5 g). Undefined while there is no
 * share between 0 and 100 % or no malt.
 */
export function acidMaltGrams(recipe: Recipe): number | undefined {
  const treatment = waterOf(recipe).treatment;
  const share = isObject(treatment) ? treatment.acid_malt : undefined;
  const others = totalGrams(ingredientsOf(recipe, "malts"));
  return finite(share) && share > 0 && share < 100 && others > 0 ? (share / (100 - share)) * others : undefined;
}

/**
 * The malts the figures count (EDT-070): the Malt tab's, then the water treatment's acid malt in whole grams (shown
 * read-only on the Malt tab, never written to the malt list).
 */
export function maltsWithAcidMalt(recipe: Recipe): Ingredient[] {
  const malts = ingredientsOf(recipe, "malts");
  const grams = acidMaltGrams(recipe);
  return grams === undefined || Math.round(grams) < 1 ? malts : [...malts, { name: ACID_MALT.name, grams: Math.round(grams), ebc: ACID_MALT.ebc }];
}

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

export function isObject(value: unknown): value is Record<string, unknown> {
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
  const draft = convertDraftSections({
    version: FORMAT_VERSION,
    ...rest,
    name: typeof source.name === "string" ? source.name : "",
    mashing_process: process,
  } as Recipe);
  changes.push(...draft.changes);
  const converted = convertSingleAdditions(draft.recipe);
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

/** One line per entry of a list: `"malts": [`, its entries, `]` (FMT-006). */
function listLines(key: string, value: unknown, indent: string, last: boolean): string[] {
  const comma = last ? "" : ",";
  if (!Array.isArray(value) || value.length === 0) {
    return [`${indent}${JSON.stringify(key)}: ${JSON.stringify(value)}${comma}`];
  }
  return [
    `${indent}${JSON.stringify(key)}: [`,
    ...value.map((entry, i) => `${indent}  ${isObject(entry) ? formatEntry(entry) : JSON.stringify(entry)}${i < value.length - 1 ? "," : ""}`),
    `${indent}]${comma}`,
  ];
}

/** The mashing plan, one line per rest in the table's order (FMT-006). */
function restsLines(rests: unknown, indent: string, last: boolean): string[] {
  const comma = last ? "" : ",";
  if (!isObject(rests)) {
    return [`${indent}"rests": ${JSON.stringify(rests)}${comma}`];
  }
  const entries = Object.entries(inPlanOrder(rests));
  if (entries.length === 0) {
    return [`${indent}"rests": {}${comma}`];
  }
  return [
    `${indent}"rests": {`,
    ...entries.map(([id, value], i) => {
      // A rest's fields in the file's order, temperature then minutes, however they were entered (FMT-006).
      // The iodine test is a marker: "{}" (app Q-49).
      const text = isObject(value) && Object.keys(value).length === 0
        ? "{}"
        : isObject(value)
        ? indentGoal((({ temperature, minutes, ...more }) => ({ temperature, minutes, ...more }))(value) as Goal)
        : JSON.stringify(value);
      return `${indent}  ${JSON.stringify(id)}: ${text}${i < entries.length - 1 ? "," : ""}`;
    }),
    `${indent}}${comma}`,
  ];
}

/**
 * A section over several lines (`mashing`, `boiling`): its keys in the file's order, each list one line per entry, the
 * mashing plan one line per rest, any other value on one line (FMT-006).
 */
function sectionLines(section: "mashing" | "boiling", value: unknown): string[] {
  if (!isObject(value) || Object.keys(value).length === 0) {
    return [`  ${JSON.stringify(section)}: ${JSON.stringify(value)}`];
  }
  const entries = Object.entries(inOrder(value, SECTION_ORDER[section]));
  const lines = [`  ${JSON.stringify(section)}: {`];
  entries.forEach(([key, v], i) => {
    const last = i === entries.length - 1;
    if (section === "mashing" && key === "rests") {
      lines.push(...restsLines(v, "    ", last));
    } else if (key === "malts" || key === "hops" || key === "others") {
      lines.push(...listLines(key, v, "    ", last));
    } else {
      lines.push(`    ${JSON.stringify(key)}: ${oneLine(v)}${last ? "" : ","}`);
    }
  });
  lines.push(`  }`);
  return lines;
}

/**
 * The file content, formatted like the app's shipped recipes: "version" first (RCP-008), the name, the description,
 * one line per goal, then the mashing (one line per malt and per rest), the boiling (one line per hop and other
 * addition), the water and the fermentation, each on one line (FMT-006, app Q-51). The editor does not write
 * "$schema" (optional, ignored by the app).
 */
export function serializeRecipe(recipe: Recipe): string {
  const { $schema: _schema, version, name, description, mashing_process: process, mashing, boiling, water, fermentation, ...rest } = recipe;
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
  const add = (more: string[]) => {
    lines[lines.length - 1] += ",";
    lines.push(...more);
  };
  if (mashing !== undefined) {
    add(sectionLines("mashing", mashing));
  }
  if (boiling !== undefined) {
    add(sectionLines("boiling", boiling));
  }
  // One line each: { "mash": 16, "sparge": 14, "top_up": 2, "target_knockout_volume": 20, "treatment": { … } } and
  // { "original_gravity": 12.6, "final_gravity": 2.5, "yeast": { "name": "WB-06", "grams": 11.5 }, "co2": 6.5 }.
  if (water !== undefined) {
    add([`  "water": ${oneLine(isObject(water) ? inOrder(water, SECTION_ORDER.water) : water)}`]);
  }
  if (fermentation !== undefined) {
    add([`  "fermentation": ${oneLine(isObject(fermentation) ? inOrder(fermentation, SECTION_ORDER.fermentation) : fermentation)}`]);
  }
  for (const [key, value] of Object.entries(rest)) {
    add([`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`]);
  }
  return `{\n${lines.join("\n")}\n}\n`;
}
