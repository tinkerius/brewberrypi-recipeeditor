/**
 * The Overview tab's summary (EDT-076, EDT-077, QE-85): the list of everything the brew needs, and the brewing time
 * (the mash schedule and the boil). Read-only: computed from the recipe with the other tabs' helpers, never stored.
 */

import {
  ACID_MALT,
  INGREDIENT_LABELS,
  WATER_FIELDS,
  WATER_LABELS,
  additionsOf,
  boilMinutesOf,
  entryGrams,
  ingredientsOf,
  maltsWithAcidMalt,
  mashInTemperature,
  restsOf,
  totalGrams,
  totalWater,
  validAlpha,
  validBoilMinutes,
  validGrams,
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
  /** A part below the total in the same box: the other additions in the Hops box (QE-90). */
  more?: { title: string; lines: ListLine[] };
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
 * treatment's acid malt, the hops (all additions of each summed, with its alpha acid) with the other additions in
 * their box (QE-90), the yeast, the water and the water treatment's gypsum and lactic acid for the mash water.
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
  // The hops and, in the same box below their total, the other boil additions (QE-90); the other additions alone get
  // their own box.
  const hops = ingredientsOf(recipe, "hops");
  const others = ingredientsOf(recipe, "others");
  const otherLines = entryLines(others, INGREDIENT_LABELS.others.one);
  if (hops.length > 0) {
    const lines = entryLines(hops, INGREDIENT_LABELS.hops.one, (h) => (validAlpha(h.alpha) ? `α ${h.alpha} %` : undefined));
    const total = totalGrams(hops);
    groups.push({
      id: "hops",
      title: "Hops",
      tab: "hops",
      lines,
      ...(total > 0 ? { total: grams(total) } : {}),
      ...(others.length > 0 ? { more: { title: INGREDIENT_LABELS.others.title, lines: otherLines } } : {}),
    });
  } else if (others.length > 0) {
    groups.push({ id: "others", title: INGREDIENT_LABELS.others.title, tab: "hops", lines: otherLines });
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

/** The boil's temperature, °C. */
export const BOIL_TEMPERATURE = 100;

/** The mash schedule at the default heating rate (the Mashing tab's rate is a view setting, not stored). */
function mashOf(recipe: Recipe) {
  const plan = restsOf(recipe);
  const steps = stepsOf(plan);
  return steps.length > 0 ? mashProfile(steps, DEFAULT_HEATING_RATE, mashInTemperature(plan)) : undefined;
}

/**
 * Heating to the boil (EDT-077, QE-91): from the mash schedule's last temperature (the mash-out) to 100 °C at the
 * same default heating rate as the mash; undefined without a mash schedule (no temperature to start from) or a boil.
 */
function heatToBoilOf(profile: ReturnType<typeof mashOf>, boil: number | undefined) {
  if (!profile || boil === undefined) {
    return undefined;
  }
  const fromTemp = profile.points[profile.points.length - 1].temp;
  return { fromTemp, minutes: Math.max(0, BOIL_TEMPERATURE - fromTemp) / DEFAULT_HEATING_RATE };
}

export interface BrewingTime {
  /** The mash schedule (EDT-039): its total, of which rests and heating; undefined while no rest has both values. */
  mash?: { total: number; rests: number; heating: number };
  /** Heating from the mash's last temperature to the boil (QE-91); undefined without the mash or the boil. */
  heatToBoil?: { fromTemp: number; minutes: number };
  /** The boil time (EDT-054); undefined while no boil addition has an amount and a cooking time. */
  boil?: number;
  /** Mash + heating to the boil + boil, while the mash and the boil are known. */
  total?: number;
  missing: ("mash" | "boil")[];
}

/**
 * The brewing time (EDT-077, QE-85, QE-91): the mash schedule as on the Mashing tab, heating to the boil, and the boil
 * as in the Boil Schedule, all at the default heating rate.
 */
export function brewingTime(recipe: Recipe): BrewingTime {
  const profile = mashOf(recipe);
  const mash = profile ? { total: profile.totalMinutes, rests: profile.holdMinutes, heating: profile.rampMinutes } : undefined;
  const boil = boilMinutesOf(recipe);
  const heatToBoil = heatToBoilOf(profile, boil);
  const missing = [...(mash ? [] : (["mash"] as const)), ...(boil !== undefined ? [] : (["boil"] as const))];
  return {
    mash,
    heatToBoil,
    boil,
    total: mash && heatToBoil && boil !== undefined ? mash.total + heatToBoil.minutes + boil : undefined,
    missing,
  };
}

/** One addition on the brew-day timeline: what, its row (for its colour, as in the Boil Schedule), and when it goes in. */
export interface TimelineAddition {
  kind: "hops" | "others";
  /** Its row in its table (EDT-047: the row's colour). */
  row: number;
  name: string;
  grams: number;
  /** Its cooking time, and the minute of the brew day it goes in (the boil's start + boil − cooking time). */
  cooking: number;
  minute: number;
}

/** A stretch of the mash on the timeline: heating from `fromTemp` to `temp`, or a rest held at `temp`. */
export interface TimelineSegment {
  kind: "heat" | "rest";
  /** The rest it heats to, or the rest held. */
  restId: string;
  fromTemp: number;
  temp: number;
  /** Minutes of the brew day. */
  from: number;
  to: number;
}

export interface BrewDayTimeline {
  mash?: { minutes: number; segments: TimelineSegment[] };
  /** Heating to the boil (QE-91), right after the mash. */
  heatToBoil?: { from: number; to: number; fromTemp: number };
  boil?: { start: number; minutes: number; additions: TimelineAddition[] };
  total: number;
}

/**
 * The brew-day timeline (EDT-078, QE-87): the brewing time of EDT-077 as one line of time. The mash schedule's
 * heating and rests (as on the Mashing tab, at the default heating rate), heating to the boil (QE-91), then the boil
 * with each boil addition at the minute it goes in. Undefined while there is neither a mash schedule nor a boil.
 */
export function brewDayTimeline(recipe: Recipe): BrewDayTimeline | undefined {
  const profile = mashOf(recipe);
  const mash = profile && {
    minutes: profile.totalMinutes,
    segments: profile.segments.map(
      (s): TimelineSegment => ({
        kind: s.kind === "ramp" ? "heat" : "rest",
        restId: s.restId,
        fromTemp: s.from.temp,
        temp: s.to.temp,
        from: s.from.minute,
        to: s.to.minute,
      }),
    ),
  };
  const minutes = boilMinutesOf(recipe);
  const heat = heatToBoilOf(profile, minutes);
  const heatToBoil = mash && heat ? { from: mash.minutes, to: mash.minutes + heat.minutes, fromTemp: heat.fromTemp } : undefined;
  const start = heatToBoil?.to ?? mash?.minutes ?? 0;
  const boil =
    minutes === undefined
      ? undefined
      : {
          start,
          minutes,
          additions: (["hops", "others"] as const)
            .flatMap((kind) =>
              ingredientsOf(recipe, kind).flatMap((entry, row) =>
                additionsOf(entry)
                  .filter((a) => validGrams(a.grams) && validBoilMinutes(a.minutes))
                  .map((a) => ({
                    kind,
                    row,
                    name: typeof entry.name === "string" && entry.name.trim() !== "" ? entry.name : `${INGREDIENT_LABELS[kind].one} ${row + 1}`,
                    grams: a.grams as number,
                    cooking: a.minutes as number,
                    minute: start + minutes - (a.minutes as number),
                  })),
              ),
            )
            .sort((a, b) => a.minute - b.minute),
        };
  if (!mash && !boil) {
    return undefined;
  }
  return { mash, heatToBoil, boil, total: start + (boil?.minutes ?? 0) };
}
