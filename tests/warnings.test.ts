import { describe, expect, it } from "vitest";
import { toRecipe, type Recipe } from "../src/model";
import { validateRecipe } from "../src/validate";
import { warningsOf } from "../src/warnings";

/** A recipe with these sections (and an empty mash process). */
const recipe = (more: Record<string, unknown>): Recipe => toRecipe({ version: 3, name: "W", mashing_process: { goals: [] }, ...more });
const paths = (r: Recipe) => warningsOf(r).map((w) => w.path);

describe("warnings: values outside their typical range (EDT-064, QE-54)", () => {
  it("ACC-093 warns outside the typical ranges, not at their limits, and the recipe stays valid", () => {
    // Mash thickness 2.5–5 L/kg (QE-58), at the mash water.
    const malts = { malts: [{ name: "Pilsner malt", grams: 4000 }] };
    expect(paths(recipe({ mashing: malts, water: { mash: 10 } }))).toEqual([]); // 2.5 L/kg
    expect(paths(recipe({ mashing: malts, water: { mash: 20 } }))).toEqual([]); // 5 L/kg
    const thick = recipe({ mashing: malts, water: { mash: 25 } });
    expect(warningsOf(thick)).toEqual([
      {
        path: "water.mash",
        message: "A mash thickness of 6.3 L/kg is outside the typical 2.5–5 L/kg.",
        short: "⚠ A mash thickness of 6.3 L/kg is outside the typical 2.5–5 L/kg.",
      },
    ]);
    expect(validateRecipe(thick)).toEqual([]);
    // Original gravity 7–22 °P, final gravity 1–5 °P, apparent attenuation 65–85 % (at the final gravity).
    expect(paths(recipe({ fermentation: { original_gravity: 7 } }))).toEqual([]);
    expect(paths(recipe({ fermentation: { original_gravity: 22 } }))).toEqual([]);
    expect(warningsOf(recipe({ fermentation: { original_gravity: 25 } })).map((w) => w.message)).toEqual([
      "An original gravity of 25 °P is outside the typical 7–22 °P.",
    ]);
    expect(paths(recipe({ fermentation: { original_gravity: 6.5 } }))).toEqual(["fermentation.original_gravity"]);
    expect(paths(recipe({ fermentation: { final_gravity: 1 } }))).toEqual([]);
    expect(paths(recipe({ fermentation: { final_gravity: 5 } }))).toEqual([]);
    expect(paths(recipe({ fermentation: { final_gravity: 6 } }))).toEqual(["fermentation.final_gravity"]);
    expect(paths(recipe({ fermentation: { original_gravity: 12, final_gravity: 3 } }))).toEqual([]); // 76 %
    expect(warningsOf(recipe({ fermentation: { original_gravity: 20, final_gravity: 1.5 } })).map((w) => [w.path, w.message])).toEqual([
      ["fermentation.final_gravity", "An apparent attenuation of 93 % is outside the typical 65–85 %."],
    ]);
    // A hop's alpha acid 2–20 %; a hop addition's cooking time up to 90 min.
    const hop = (alpha: number, minutes: number) => recipe({ boiling: { hops: [{ name: "H", alpha, additions: [{ minutes: 10, grams: 5 }, { minutes, grams: 5 }] }] } });
    expect(paths(hop(2, 90))).toEqual([]);
    expect(paths(hop(20, 0))).toEqual([]);
    expect(warningsOf(hop(25, 120)).map((w) => [w.path, w.message, w.short])).toEqual([
      ["boiling.hops[0].alpha", "An alpha acid of 25 % is outside the typical 2–20 %.", "⚠ α typically 2–20 %"],
      [
        "boiling.hops[0].additions[1].minutes",
        "Addition 2: a cooking time of 120 min is above the typical 90 min.",
        "⚠ Addition 2: typically up to 90 min",
      ],
    ]);
    expect(paths(hop(1.5, 60))).toEqual(["boiling.hops[0].alpha"]);
    // Other additions have no typical cooking time.
    expect(paths(recipe({ boiling: { others: [{ name: "Irish moss", additions: [{ minutes: 120, grams: 5 }] }] } }))).toEqual([]);
    // The CO₂ target 3.5–7.5 g/L (EDT-066).
    expect(paths(recipe({ fermentation: { co2: 3.5 } }))).toEqual([]);
    expect(paths(recipe({ fermentation: { co2: 7.5 } }))).toEqual([]);
    expect(warningsOf(recipe({ fermentation: { co2: 8 } })).map((w) => [w.path, w.message])).toEqual([
      ["fermentation.co2", "A CO₂ target of 8 g/L is outside the typical 3.5–7.5 g/L."],
    ]);
    expect(paths(recipe({ fermentation: { co2: 3 } }))).toEqual(["fermentation.co2"]);
    expect(paths(recipe({ fermentation: { co2: 0 } }))).toEqual([]); // an error, no warning
    // The water treatment (EDT-069): gypsum up to 3 g/10 L, acid malt up to 5 %, the result at most the target.
    const treated = (treatment: Record<string, unknown>) => recipe({ water: { treatment } });
    expect(paths(treated({ gypsum: 3, acid_malt: 5 }))).toEqual([]);
    expect(paths(treated({ gypsum: 3.5, acid_malt: 6 }))).toEqual(["water.treatment.gypsum", "water.treatment.acid_malt"]);
    const pale = { malts: [{ name: "Pilsner malt", grams: 4600, ebc: 7 }] };
    expect(paths(recipe({ mashing: pale, water: { target_knockout_volume: 24, treatment: { alkalinity: 2 } } }))).toEqual([]);
    expect(paths(recipe({ mashing: pale, water: { target_knockout_volume: 24, treatment: { alkalinity: 2.5 } } }))).toEqual([
      "water.treatment.result",
    ]);
    expect(paths(treated({ alkalinity: 12 }))).toEqual([]); // no target without the beer colour
    // A mash rest's temperature and duration, at their fields (EDT-033, EDT-038).
    const rest = (temperature: number, minutes: number) => recipe({ mashing: { rests: { MaltoseRest: { temperature, minutes } } } });
    // (A maltose rest alone does not convert all the starch: that is the whole plan's warning, "mashing.rests".)
    expect(paths(rest(63, 45))).toEqual(["mashing.rests"]);
    expect(warningsOf(rest(70, 90)).map((w) => [w.path, w.short])).toEqual([
      ["mashing.rests.MaltoseRest.temperature", "⚠ Outside the typical range"],
      ["mashing.rests.MaltoseRest.minutes", "⚠ Outside the typical duration"],
      ["mashing.rests", "⚠ No Combined rest or Saccharification rest: the starch may not be converted completely."],
    ]);
    // A value that is a problem gets no warning as well.
    expect(paths(recipe({ fermentation: { original_gravity: 41 } }))).toEqual([]);
    expect(paths(recipe({ boiling: { hops: [{ name: "H", alpha: 101, additions: [{ grams: 5 }] }] } }))).toEqual([]);
  });
});
