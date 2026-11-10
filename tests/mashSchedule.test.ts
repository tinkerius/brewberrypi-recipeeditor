import { describe, expect, it } from "vitest";
import { MASH_RESTS, MASH_REST_IDS, MASH_TEMPERATURE_LIMIT, type MashRestId } from "../src/mashRests";
import { bandLanes, mashProfile, restsByTypical, scheduleWarnings, spreadLabels, stepsOf, type MashStep } from "../src/mashSchedule";

const step = (restId: MashRestId, targetTemp: number, holdMinutes: number): MashStep => ({ restId, targetTemp, holdMinutes });

/** The product owner's example (QE-33): "Hochkurz" with a pre-mash. */
const HOCHKURZ = [step("PreMash", 35, 15), step("MaltoseRest", 63, 45), step("SaccharificationRest", 72, 30), step("MashOut", 78, 5)];

describe("rest data (QE-33)", () => {
  it("ACC-062 holds every rest once, with a consistent typical temperature, range, duration and texts", () => {
    expect(Object.keys(MASH_RESTS).sort()).toEqual([...MASH_REST_IDS].sort());
    for (const id of MASH_REST_IDS) {
      const r = MASH_RESTS[id];
      expect(r.tempMin <= r.tempTypical && r.tempTypical <= r.tempMax, id).toBe(true);
      expect(r.tempMax <= MASH_TEMPERATURE_LIMIT, id).toBe(true);
      if (r.durationMin !== null && r.durationMax !== null) {
        expect(r.durationMin <= r.durationMax, id).toBe(true);
      }
      // The presets are inside the typical duration, so a fresh plan has no warnings for them.
      expect(r.durationMin === null || r.minutes >= r.durationMin, id).toBe(true);
      expect(r.durationMax === null || r.minutes <= r.durationMax, id).toBe(true);
      expect(r.enzymes.length > 0 && r.about.length === 3, id).toBe(true);
    }
    expect(MASH_RESTS.AcidRest.flags).toContain("obsolete");
    expect(MASH_RESTS.MashOut.flags).toContain("always");
    expect(MASH_REST_IDS.filter((id) => MASH_RESTS[id].flags.includes("conversion"))).toEqual(["CombinedRest", "SaccharificationRest"]);
  });

  it("ACC-062 sorts the rests by typical temperature, ties in table order", () => {
    const order = restsByTypical();
    expect(order.map((id) => MASH_RESTS[id].tempTypical)).toEqual([25, 35, 40, 45, 52, 63, 67, 72, 78]);
    expect(order.slice(0, 2)).toEqual(["PreMash", "AcidRest"]);
  });

  it("ACC-062 puts overlapping or touching bands into different lanes", () => {
    const lanes = bandLanes();
    for (const a of MASH_REST_IDS) {
      for (const b of MASH_REST_IDS) {
        const [x, y] = [MASH_RESTS[a], MASH_RESTS[b]];
        if (a !== b && lanes[a] === lanes[b]) {
          expect(x.tempMax < y.tempMin || x.tempMin > y.tempMax, `${a} and ${b}`).toBe(true);
        }
      }
    }
    expect(lanes.CombinedRest).not.toBe(lanes.MaltoseRest); // they touch at 65 °C
  });

  it("ACC-062 spreads labels so that none collide, within the bounds", () => {
    const want = [100, 100, 104, 300, 10];
    const placed = spreadLabels(want, 24, 20, 280);
    const sorted = [...placed].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(24);
    }
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...placed)).toBeLessThanOrEqual(280);
    expect(placed[0]).toBe(100); // the first label keeps its place; the tie goes below it
  });
});

describe("mash schedule (QE-33)", () => {
  it("ACC-063 computes the profile of Hochkurz at 1 °C/min: ramps, holds and the total time", () => {
    const profile = mashProfile(HOCHKURZ, 1);
    expect([profile.holdMinutes, profile.rampMinutes, profile.totalMinutes]).toEqual([95, 43, 138]);
    expect(profile.points).toEqual([
      { minute: 0, temp: 35 },
      { minute: 15, temp: 35 },
      { minute: 43, temp: 63 },
      { minute: 88, temp: 63 },
      { minute: 97, temp: 72 },
      { minute: 127, temp: 72 },
      { minute: 133, temp: 78 },
      { minute: 138, temp: 78 },
    ]);
    expect(profile.segments.map((s) => `${s.kind} ${s.restId}`)).toEqual([
      "hold PreMash",
      "ramp MaltoseRest",
      "hold MaltoseRest",
      "ramp SaccharificationRest",
      "hold SaccharificationRest",
      "ramp MashOut",
      "hold MashOut",
    ]);
    expect(scheduleWarnings(HOCHKURZ)).toEqual([]);
  });

  it("ACC-063 scales the ramps with the heating rate and starts at the start temperature", () => {
    expect(mashProfile(HOCHKURZ, 2).rampMinutes).toBe(21.5);
    expect(mashProfile(HOCHKURZ, 0.5).totalMinutes).toBe(95 + 86);
    const fromCold = mashProfile([step("MaltoseRest", 63, 45)], 1, 20);
    expect([fromCold.rampMinutes, fromCold.totalMinutes]).toEqual([43, 88]);
    expect(mashProfile([], 1)).toEqual({ segments: [], points: [], rampMinutes: 0, holdMinutes: 0, totalMinutes: 0 });
    expect(mashProfile(HOCHKURZ, 0).rampMinutes).toBe(43); // an invalid rate falls back to the default
  });

  it("ACC-063 takes the steps of a plan in table order and leaves out rests without valid numbers", () => {
    const plan = {
      MashOut: { temperature: 78, minutes: 5 },
      PreMash: { temperature: 35, minutes: 15 },
      MaltoseRest: { temperature: "63", minutes: 45 },
      SaccharificationRest: { temperature: 72, minutes: 2.5 },
      Unknown: { temperature: 50, minutes: 10 },
    };
    expect(stepsOf(plan)).toEqual([step("PreMash", 35, 15), step("MashOut", 78, 5)]);
  });

  it("ACC-064 warns about falling steps, steps above 78 °C, no conversion and holds outside the typical duration", () => {
    const warnings = (steps: MashStep[]) => scheduleWarnings(steps).map((w) => w.message);
    expect(warnings([step("MaltoseRest", 66, 45), step("SaccharificationRest", 64, 30)])).toEqual([
      "Saccharification rest at 64 °C is lower than the Maltose rest before it (66 °C): the steps should rise.",
    ]);
    expect(warnings([step("SaccharificationRest", 72, 30), step("MashOut", 80, 5)])).toEqual([
      "Mash-out at 80 °C is above 78 °C: α-amylase is destroyed and unconverted starch stays in the wort.",
    ]);
    expect(warnings([step("ProteinRest", 52, 10), step("MaltoseRest", 63, 45)])).toEqual([
      "No Combined rest or Saccharification rest: the starch may not be converted completely.",
    ]);
    expect(warnings([step("CombinedRest", 67, 60)])).toEqual([]);
    expect(warnings([step("MaltoseRest", 63, 90), step("SaccharificationRest", 72, 10)])).toEqual([
      "Maltose rest for 90 min is outside its typical duration (30–60 min).",
      "Saccharification rest for 10 min is outside its typical duration (20–40 min, until iodine-negative).",
    ]);
    expect(warnings([step("PreMash", 20, 240), step("CombinedRest", 67, 60)])).toEqual([]); // cold pre-mash: no upper limit
    expect(warnings([])).toEqual([]);
    expect(scheduleWarnings([step("MashOut", 80, 5)]).map((w) => w.restId)).toEqual(["MashOut", undefined]);
  });
});
