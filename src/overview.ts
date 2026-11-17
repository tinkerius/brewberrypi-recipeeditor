/**
 * The Overview tab's summary (EDT-076, EDT-077, QE-85): the list of everything the brew needs, and the brewing time
 * (the mash schedule and the boil). Read-only: computed from the recipe with the other tabs' helpers, never stored.
 */

import {
  ACID_MALT,
  INGREDIENT_LABELS,
  WATER_FIELDS,
  WATER_LABELS,
  WATER_RULES,
  additionsOf,
  batchOf,
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
  validLiters,
  validWater,
  waterOf,
  whirlpoolOf,
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

/**
 * The rules of thumb for the brew-day steps the recipe has no time for (EDT-077, QE-92): the lauter rest and how fast
 * the wort runs off, the whirlpool, filtering the wort off the trub, and how fast it is cooled.
 */
export const BREW_DAY_RULES = {
  lauterRestMinutes: 15,
  runOffLitresPerMinute: 1,
  whirlpoolMinutes: 5,
  filteringMinutes: 5,
  coolingMinutesPerLitre: 1,
} as const;

/** The steps of the brew day between and after the mash and the boil, in this order (QE-91, QE-92). */
export type StageId = "lautering" | "heat-to-boil" | "whirlpool" | "filtering" | "cooling";

export const STAGE_LABELS: Record<StageId, string> = {
  lautering: "Lautering",
  "heat-to-boil": "Heating to the boil",
  whirlpool: "Whirlpool",
  filtering: "Filtering",
  cooling: "Cooling",
};

/** One of those steps on the brew day: when, and how its time is worked out. */
export interface TimelineStage {
  id: StageId;
  from: number;
  to: number;
  /** How its time is worked out ("15 min lauter rest + 26 L ÷ 1 L/min"). */
  rule: string;
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
  /** The mash schedule, from 0:00. */
  mash?: { minutes: number; segments: TimelineSegment[] };
  /** Lautering and heating to the boil before the boil, whirlpool, filtering and cooling after it, in time order. */
  stages: TimelineStage[];
  boil?: { start: number; minutes: number; additions: TimelineAddition[] };
  total: number;
}

/** One decimal for the rules' litres: "26 L", "12.5 L". */
const litresText = (value: number) => `${oneDecimal(value)} L`;

/**
 * The brew day (EDT-077, EDT-078, QE-85, QE-91, QE-92): the mash schedule as on the Mashing tab (at the default
 * heating rate; the tab's rate is a view setting, not stored), lautering, heating from the mash's last temperature to
 * the boil at the same rate, the boil as in the Boil Schedule, the whirlpool while it is ticked, filtering and cooling.
 * The steps the recipe has no time for are estimated from its water (BREW_DAY_RULES); a step that can't be estimated
 * yet is left out and named in `missing`. Undefined while there is neither a mash schedule nor a boil.
 */
function brewDay(recipe: Recipe): (BrewDayTimeline & { missing: string[] }) | undefined {
  const plan = restsOf(recipe);
  const steps = stepsOf(plan);
  const profile = steps.length > 0 ? mashProfile(steps, DEFAULT_HEATING_RATE, mashInTemperature(plan)) : undefined;
  const boilMinutes = boilMinutesOf(recipe);
  if (!profile && boilMinutes === undefined) {
    return undefined;
  }
  const rules = BREW_DAY_RULES;
  const water = waterOf(recipe);
  const knockout = batchOf(recipe).target_knockout_volume;
  const stages: TimelineStage[] = [];
  const missing: string[] = [];
  let minute = 0;
  const add = (id: StageId, minutes: number, rule: string) => {
    stages.push({ id, from: minute, to: minute + minutes, rule });
    minute += minutes;
  };
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
  if (profile) {
    minute = profile.totalMinutes;
    // Lautering: the lauter rest, then the first wort (the mash water the grain does not keep) and the sparge water run off.
    const mashWater = water.mash;
    if (validWater(mashWater)) {
      const kg = totalGrams(maltsWithAcidMalt(recipe)) / 1000;
      const firstWort = Math.max(0, mashWater - kg * WATER_RULES.absorptionPerKg);
      const sparge = validWater(water.sparge) ? water.sparge : 0;
      const runOff = (firstWort + sparge) / rules.runOffLitresPerMinute;
      add(
        "lautering",
        Math.round(rules.lauterRestMinutes + runOff),
        `${rules.lauterRestMinutes} min lauter rest + (${litresText(firstWort)} first wort + ${litresText(sparge)} sparge water) ÷ ` +
          `${rules.runOffLitresPerMinute} L/min`,
      );
    } else {
      missing.push("Enter the mash water on the Water tab for the lautering.");
    }
    if (boilMinutes !== undefined) {
      const fromTemp = profile.points[profile.points.length - 1].temp;
      add(
        "heat-to-boil",
        Math.max(0, BOIL_TEMPERATURE - fromTemp) / DEFAULT_HEATING_RATE,
        `from ${fromTemp} °C to ${BOIL_TEMPERATURE} °C at ${DEFAULT_HEATING_RATE} °C/min`,
      );
    }
  }
  let boil: BrewDayTimeline["boil"];
  if (boilMinutes !== undefined) {
    const start = minute;
    boil = {
      start,
      minutes: boilMinutes,
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
                minute: start + boilMinutes - (a.minutes as number),
              })),
          ),
        )
        .sort((a, b) => a.minute - b.minute),
    };
    minute += boilMinutes;
    if (whirlpoolOf(recipe)) {
      add("whirlpool", rules.whirlpoolMinutes, `${rules.whirlpoolMinutes} min whirlpool`);
    }
    // The wort is filtered off the trub first, then cooled (QE-92).
    add("filtering", rules.filteringMinutes, `${rules.filteringMinutes} min filtering`);
    if (validLiters(knockout)) {
      add("cooling", Math.round(knockout * rules.coolingMinutesPerLitre), `${litresText(knockout)} × ${rules.coolingMinutesPerLitre} min/L`);
    } else {
      missing.push("Enter the knockout volume on the Water tab for the cooling.");
    }
  }
  return { mash, stages, boil, total: minute, missing };
}

export interface BrewingTime {
  /** The mash schedule (EDT-039): its total, of which rests and heating; undefined while no rest has both values. */
  mash?: { total: number; rests: number; heating: number };
  /** The boil time (EDT-054); undefined while no boil addition has an amount and a cooking time. */
  boil?: number;
  /** The steps besides the mash and the boil, with their minutes (QE-91, QE-92). */
  stages: { id: StageId; minutes: number; rule: string }[];
  /** The whole brew day, while the mash and the boil are known. */
  total?: number;
  /** What to enter for what is not counted yet, one sentence each. */
  missing: string[];
}

/** The brewing time (EDT-077): the brew day's total while the mash and the boil are known, and what is missing. */
export function brewingTime(recipe: Recipe): BrewingTime {
  const day = brewDay(recipe);
  const profileMash = day?.mash;
  const rests = profileMash?.segments.filter((s) => s.kind === "rest").reduce((sum, s) => sum + s.to - s.from, 0) ?? 0;
  const mash = profileMash ? { total: profileMash.minutes, rests, heating: profileMash.minutes - rests } : undefined;
  const boil = day?.boil?.minutes;
  const missing = [
    ...(mash ? [] : ["Plan the rests on the Mashing tab."]),
    ...(boil !== undefined ? [] : ["Enter the cooking times on the Boiling tab."]),
    ...(day?.missing ?? []),
  ];
  return {
    mash,
    boil,
    stages: (day?.stages ?? []).map((s) => ({ id: s.id, minutes: s.to - s.from, rule: s.rule })),
    total: mash && boil !== undefined ? day!.total : undefined,
    missing,
  };
}

/**
 * The brew-day timeline (EDT-078, QE-87): the brew day as one line of time. Undefined while there is neither a mash
 * schedule nor a boil.
 */
export function brewDayTimeline(recipe: Recipe): BrewDayTimeline | undefined {
  const day = brewDay(recipe);
  if (!day) {
    return undefined;
  }
  const { missing: _missing, ...timeline } = day;
  return timeline;
}
