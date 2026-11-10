/**
 * The mash schedule behind the temperature ladder (EDT-036..040, QE-33): the planned rests as steps, the
 * temperature profile with its heating ramps and total time, the schedule's warnings, and the layout helpers of
 * the ladder (lanes for overlapping bands, labels that don't collide). Pure functions: every value comes from
 * `mashRests.ts` or the recipe, none is written here.
 */

import { MASH_REST_IDS, MASH_RESTS, MASH_TEMPERATURE_LIMIT, type MashRestId } from "./mashRests";

export interface MashStep {
  restId: MashRestId;
  targetTemp: number;
  holdMinutes: number;
}

/** The default heating rate of the kettle, °C per minute (EDT-039). */
export const DEFAULT_HEATING_RATE = 1;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The steps of a mashing plan (the recipe's "mashing"), in the table's order (EDT-031). A rest whose temperature or
 * duration is not a valid number yet is left out until it is.
 */
export function stepsOf(plan: Record<string, unknown>): MashStep[] {
  const steps: MashStep[] = [];
  for (const restId of MASH_REST_IDS) {
    const rest = plan[restId];
    if (!isObject(rest)) {
      continue;
    }
    const { temperature, minutes } = rest;
    if (typeof temperature === "number" && Number.isFinite(temperature) && typeof minutes === "number" && Number.isInteger(minutes) && minutes >= 0) {
      steps.push({ restId, targetTemp: temperature, holdMinutes: minutes });
    }
  }
  return steps;
}

/** One part of the profile: heating (or cooling) to a step's temperature, or holding it. */
export interface ProfileSegment {
  kind: "ramp" | "hold";
  restId: MashRestId;
  from: { minute: number; temp: number };
  to: { minute: number; temp: number };
}

export interface MashProfile {
  segments: ProfileSegment[];
  /** The corners of the step function, from the start to the end of the last hold. */
  points: { minute: number; temp: number }[];
  rampMinutes: number;
  holdMinutes: number;
  totalMinutes: number;
}

/**
 * The temperature profile of the steps (EDT-039): from `startTemp` (default: the first step's temperature) the
 * kettle heats to each step's temperature at `heatingRate` °C/min, then holds it for the step's minutes. A step
 * lower than the one before is reached at the same rate (and warned about, `scheduleWarnings`).
 */
export function mashProfile(steps: MashStep[], heatingRate = DEFAULT_HEATING_RATE, startTemp?: number): MashProfile {
  const segments: ProfileSegment[] = [];
  const rate = heatingRate > 0 && Number.isFinite(heatingRate) ? heatingRate : DEFAULT_HEATING_RATE;
  let minute = 0;
  let temp = startTemp ?? steps[0]?.targetTemp ?? 0;
  const points = steps.length > 0 ? [{ minute, temp }] : [];
  let rampMinutes = 0;
  let holdMinutes = 0;
  for (const step of steps) {
    const ramp = Math.abs(step.targetTemp - temp) / rate;
    if (ramp > 0) {
      segments.push({ kind: "ramp", restId: step.restId, from: { minute, temp }, to: { minute: minute + ramp, temp: step.targetTemp } });
      minute += ramp;
      temp = step.targetTemp;
      rampMinutes += ramp;
      points.push({ minute, temp });
    }
    if (step.holdMinutes > 0) {
      segments.push({ kind: "hold", restId: step.restId, from: { minute, temp }, to: { minute: minute + step.holdMinutes, temp } });
      minute += step.holdMinutes;
      holdMinutes += step.holdMinutes;
      points.push({ minute, temp });
    }
  }
  return { segments, points, rampMinutes, holdMinutes, totalMinutes: minute };
}

export interface ScheduleWarning {
  /** The step it is about; none for the whole schedule. */
  restId?: MashRestId;
  message: string;
}

/**
 * The schedule's warnings (EDT-038): not errors, the recipe stays valid. A step not above the one before, a
 * temperature above the limit, no step that converts the starch, a hold outside the rest's typical duration.
 */
export function scheduleWarnings(steps: MashStep[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  steps.forEach((step, i) => {
    const info = MASH_RESTS[step.restId];
    const before = steps[i - 1];
    if (before && step.targetTemp < before.targetTemp) {
      warnings.push({
        restId: step.restId,
        message: `${info.short} at ${step.targetTemp} °C is lower than the ${MASH_RESTS[before.restId].short} before it (${before.targetTemp} °C): the steps should rise.`,
      });
    }
    if (step.targetTemp > MASH_TEMPERATURE_LIMIT) {
      warnings.push({
        restId: step.restId,
        message: `${info.short} at ${step.targetTemp} °C is above ${MASH_TEMPERATURE_LIMIT} °C: α-amylase is destroyed and unconverted starch stays in the wort.`,
      });
    }
    const { durationMin, durationMax } = info;
    if ((durationMin !== null && step.holdMinutes < durationMin) || (durationMax !== null && step.holdMinutes > durationMax)) {
      warnings.push({
        restId: step.restId,
        message: `${info.short} for ${step.holdMinutes} min is outside its typical duration (${info.duration}).`,
      });
    }
  });
  if (steps.length > 0 && !steps.some((step) => MASH_RESTS[step.restId].flags.includes("conversion"))) {
    const names = MASH_REST_IDS.filter((id) => MASH_RESTS[id].flags.includes("conversion")).map((id) => MASH_RESTS[id].short);
    warnings.push({ message: `No ${names.join(" or ")}: the starch may not be converted completely.` });
  }
  return warnings;
}

/** The rests sorted by typical temperature, lowest first (EDT-036); ties keep the table's order. */
export function restsByTypical(): MashRestId[] {
  return [...MASH_REST_IDS].sort((a, b) => MASH_RESTS[a].tempTypical - MASH_RESTS[b].tempTypical);
}

/**
 * A lane for each rest's band (EDT-036), so that bands whose ranges overlap or touch never share one: the first
 * lane whose bands all lie apart from it.
 */
export function bandLanes(): Record<MashRestId, number> {
  const lanes: { min: number; max: number }[][] = [];
  const result = {} as Record<MashRestId, number>;
  const order = [...MASH_REST_IDS].sort((a, b) => MASH_RESTS[a].tempMin - MASH_RESTS[b].tempMin);
  for (const id of order) {
    const { tempMin: min, tempMax: max } = MASH_RESTS[id];
    let lane = lanes.findIndex((bands) => bands.every((b) => max < b.min || min > b.max));
    if (lane < 0) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push({ min, max });
    result[id] = lane;
  }
  return result;
}

/**
 * Label positions (EDT-036): each label wants to sit at `want` (a y coordinate, growing downwards); labels are
 * moved apart to keep `gap` between them and stay inside `top`..`bottom`. Returns the positions in the input order.
 */
export function spreadLabels(want: number[], gap: number, top: number, bottom: number): number[] {
  const order = want.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const placed = order.map((o) => Math.max(top, o.y));
  for (let k = 1; k < placed.length; k++) {
    placed[k] = Math.max(placed[k], placed[k - 1] + gap);
  }
  // Too low at the bottom: push back up, keeping the gaps.
  if (placed.length > 0 && placed[placed.length - 1] > bottom) {
    placed[placed.length - 1] = bottom;
    for (let k = placed.length - 2; k >= 0; k--) {
      placed[k] = Math.min(placed[k], placed[k + 1] - gap);
    }
  }
  const result: number[] = new Array(want.length);
  order.forEach((o, k) => (result[o.i] = placed[k]));
  return result;
}
