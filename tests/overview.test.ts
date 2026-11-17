import { describe, expect, it } from "vitest";
import { toRecipe, type Recipe } from "../src/model";
import { mashProfile, stepsOf } from "../src/mashSchedule";
import { brewDayTimeline, brewingTime, ingredientList } from "../src/overview";

const recipe = (more: Record<string, unknown>): Recipe => toRecipe({ version: 3, name: "O", mashing_process: { goals: [] }, ...more });

/** The groups as [id, [name, amount, note?][], total?] for comparing. */
const shown = (r: Recipe) =>
  ingredientList(r).map((g) => [g.id, g.lines.map((l) => (l.note ? [l.name, l.amount, l.note] : [l.name, l.amount])), g.total]);

describe("the Overview's ingredient list (EDT-076, QE-85)", () => {
  it("ACC-111 lists malt, hops, other additions, yeast, water and the water treatment in this order, with totals", () => {
    const r = recipe({
      mashing: { malts: [{ name: "Pilsner malt", grams: 4500 }, { name: "Munich malt" }] },
      boiling: {
        whirlpool: true,
        hops: [
          { name: "Hallertauer", alpha: 5.5, additions: [{ minutes: 60, grams: 20 }, { minutes: 10, grams: 10 }] },
          { name: "Saaz", additions: [{ minutes: 5, grams: 10 }] },
          { name: "Saaz", alpha: "x", additions: [{ minutes: 0, grams: 5 }] },
        ],
        others: [{ name: "Irish Moss", additions: [{ minutes: 5, grams: 10 }] }],
      },
      water: { mash: 16, sparge: 14, target_knockout_volume: 24, treatment: { gypsum: 1.5, acid_malt: 1, alkalinity: 10 } },
      fermentation: { original_gravity: 12, yeast: { name: "WB-06", grams: 11.5 }, co2: 6 },
    });
    expect(shown(r)).toEqual([
      ["malts", [["Pilsner malt", "4500 g"], ["Munich malt", "–"], ["Acid malt", "45 g", "from the water treatment"]], "4545 g"],
      ["hops", [["Hallertauer", "30 g", "α 5.5 %"], ["Saaz", "10 g"], ["Saaz", "5 g"]], "45 g"],
      ["others", [["Irish Moss", "10 g"]], undefined],
      ["yeast", [["WB-06", "11.5 g"]], undefined],
      ["water", [["Mash water", "16 L"], ["Sparge water", "14 L"]], "30 L"],
      ["treatment", [["Brewing gypsum", "2.4 g"]], undefined],
    ]);
    expect(ingredientList(r).map((g) => [g.title, g.tab])).toEqual([
      ["Malt", "malts"],
      ["Hops", "hops"],
      ["Other additions", "hops"],
      ["Yeast", "fermentation"],
      ["Water", "water"],
      ["Water treatment", "water"],
    ]);
  });

  it("ACC-111 names an entry without a name by its table and number, and leaves empty groups out", () => {
    expect(ingredientList(recipe({}))).toEqual([]);
    expect(shown(recipe({ mashing: { malts: [{ name: "", grams: 1 }, {}] } }))).toEqual([["malts", [["Malt 1", "1 g"], ["Malt 2", "–"]], "1 g"]]);
    // The lactic acid in ml for the mash water; a ticked step without an amount, or without mash water, is not listed.
    expect(shown(recipe({ water: { mash: 18, treatment: { lactic_acid: 0.5, gypsum: null } } }))).toEqual([
      ["water", [["Mash water", "18 L"]], "18 L"],
      ["treatment", [["Lactic acid 80 %", "0.9 ml"]], undefined],
    ]);
    expect(shown(recipe({ water: { treatment: { gypsum: 1.5 } } }))).toEqual([]);
    // A yeast without a name or amount.
    expect(shown(recipe({ fermentation: { yeast: { grams: 11 } } }))).toEqual([["yeast", [["Yeast", "11 g"]], undefined]]);
  });
});

describe("the Overview's brewing time (EDT-077, QE-85)", () => {
  const rests = { MashIn: { temperature: 57 }, MaltoseRest: { temperature: 63, minutes: 45 }, MashOut: { temperature: 78, minutes: 10 } };
  const hops = [{ name: "H", additions: [{ minutes: 60, grams: 20 }, { minutes: 10, grams: 10 }] }];

  it("ACC-112 adds the mash schedule at 1 °C/min and the boil", () => {
    const profile = mashProfile(stepsOf(rests), 1, 57);
    const time = brewingTime(recipe({ mashing: { rests }, boiling: { whirlpool: true, hops } }));
    expect(time).toEqual({
      mash: { total: profile.totalMinutes, rests: 55, heating: 21 },
      boil: 60,
      total: profile.totalMinutes + 60,
      missing: [],
    });
    expect(profile.totalMinutes).toBe(76);
  });

  it("ACC-112 says what is missing", () => {
    expect(brewingTime(recipe({}))).toEqual({ mash: undefined, boil: undefined, total: undefined, missing: ["mash", "boil"] });
    expect(brewingTime(recipe({ mashing: { rests: { MashIn: { temperature: 57 } } }, boiling: { hops } })).missing).toEqual(["mash"]);
    expect(brewingTime(recipe({ mashing: { rests }, boiling: { hops: [{ name: "H", additions: [{ grams: 5 }] }] } })).missing).toEqual(["boil"]);
  });
});

describe("the Overview's brew-day timeline (EDT-078, QE-87)", () => {
  it("ACC-113 puts the mash's heating and rests, then the boil, each addition at its minute", () => {
    const rests = { MashIn: { temperature: 57 }, MaltoseRest: { temperature: 63, minutes: 45 }, MashOut: { temperature: 78, minutes: 10 } };
    const timeline = brewDayTimeline(
      recipe({
        mashing: { rests },
        boiling: {
          whirlpool: true,
          hops: [{ name: "H", additions: [{ minutes: 60, grams: 20 }, { minutes: 10, grams: 10 }, { grams: 5 }] }, { name: "", additions: [{ minutes: 0, grams: 5 }] }],
          others: [{ name: "Irish Moss", additions: [{ minutes: 10, grams: 5 }] }],
        },
      }),
    )!;
    // The Mashing tab's schedule at 1 °C/min, as stretches of heating and rests.
    expect(timeline.mash!.minutes).toBe(mashProfile(stepsOf(rests), 1, 57).totalMinutes);
    expect(timeline.mash!.segments).toEqual([
      { kind: "heat", restId: "MaltoseRest", fromTemp: 57, temp: 63, from: 0, to: 6 },
      { kind: "rest", restId: "MaltoseRest", fromTemp: 63, temp: 63, from: 6, to: 51 },
      { kind: "heat", restId: "MashOut", fromTemp: 63, temp: 78, from: 51, to: 66 },
      { kind: "rest", restId: "MashOut", fromTemp: 78, temp: 78, from: 66, to: 76 },
    ]);
    expect([timeline.boil!.start, timeline.boil!.minutes, timeline.total]).toEqual([76, 60, 136]);
    // In the order they go in; one without a cooking time is left out; one without a name is called by its row.
    expect(timeline.boil!.additions.map((a) => [a.kind, a.row, a.name, a.minute])).toEqual([
      ["hops", 0, "H", 76],
      ["hops", 0, "H", 126],
      ["others", 0, "Irish Moss", 126],
      ["hops", 1, "Hop 2", 136],
    ]);
  });

  it("ACC-113 has only the boil without a mash schedule, only the mash without a boil, and nothing without both", () => {
    const hops = [{ name: "H", additions: [{ minutes: 60, grams: 20 }] }];
    const onlyBoil = brewDayTimeline(recipe({ boiling: { hops } }))!;
    expect([onlyBoil.mash, onlyBoil.boil!.start, onlyBoil.total]).toEqual([undefined, 0, 60]);
    const onlyMash = brewDayTimeline(recipe({ mashing: { rests: { MashIn: { temperature: 63 }, MaltoseRest: { temperature: 63, minutes: 45 } } } }))!;
    expect([onlyMash.boil, onlyMash.total, onlyMash.mash!.segments.map((s) => s.kind)]).toEqual([undefined, 45, ["rest"]]);
    expect(brewDayTimeline(recipe({}))).toBeUndefined();
  });
});
