import { describe, expect, it } from "vitest";
import { toRecipe, type Recipe } from "../src/model";
import { mashProfile, stepsOf } from "../src/mashSchedule";
import { brewDayTimeline, brewingTime, ingredientList } from "../src/overview";

const recipe = (more: Record<string, unknown>): Recipe => toRecipe({ version: 3, name: "O", mashing_process: { goals: [] }, ...more });

/** The groups as [id, [name, amount, note?][], total?, more?] for comparing. */
const line = (l: { name: string; amount: string; note?: string }) => (l.note ? [l.name, l.amount, l.note] : [l.name, l.amount]);
const shown = (r: Recipe) =>
  ingredientList(r).map((g) => [g.id, g.lines.map(line), g.total, ...(g.more ? [[g.more.title, g.more.lines.map(line)]] : [])]);

describe("the Overview's ingredient list (EDT-076, QE-85)", () => {
  it("ACC-111 lists malt, hops with the other additions, yeast, water and the water treatment in this order, with totals", () => {
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
      // The other additions in the Hops box, below the hops' total (QE-90).
      ["hops", [["Hallertauer", "30 g", "α 5.5 %"], ["Saaz", "10 g"], ["Saaz", "5 g"]], "45 g", ["Other additions", [["Irish Moss", "10 g"]]]],
      ["yeast", [["WB-06", "11.5 g"]], undefined],
      ["water", [["Mash water", "16 L"], ["Sparge water", "14 L"]], "30 L"],
      ["treatment", [["Brewing gypsum", "2.4 g"]], undefined],
    ]);
    expect(ingredientList(r).map((g) => [g.title, g.tab])).toEqual([
      ["Malt", "malts"],
      ["Hops", "hops"],
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
    // The other additions without hops have their own box.
    expect(shown(recipe({ boiling: { others: [{ name: "Irish Moss", additions: [{ grams: 10 }] }] } }))).toEqual([["others", [["Irish Moss", "10 g"]], undefined]]);
    // A yeast without a name or amount.
    expect(shown(recipe({ fermentation: { yeast: { grams: 11 } } }))).toEqual([["yeast", [["Yeast", "11 g"]], undefined]]);
  });
});

describe("the Overview's brewing time (EDT-077, QE-85, QE-91, QE-92)", () => {
  const rests = { MashIn: { temperature: 57 }, MaltoseRest: { temperature: 63, minutes: 45 }, MashOut: { temperature: 78, minutes: 10 } };
  const hops = [{ name: "H", additions: [{ minutes: 60, grams: 20 }, { minutes: 10, grams: 10 }] }];
  /** 5 kg of malt, 18 L mash and 14 L sparge water, 24 L knockout volume. */
  const brewDay = {
    mashing: { malts: [{ name: "Pilsner malt", grams: 5000 }], rests },
    boiling: { whirlpool: true, hops },
    water: { mash: 18, sparge: 14, target_knockout_volume: 24 },
  };

  it("ACC-112 adds the mash schedule, heating to the boil and the boil, with the estimated steps", () => {
    const profile = mashProfile(stepsOf(rests), 1, 57);
    expect(profile.totalMinutes).toBe(76);
    const time = brewingTime(recipe(brewDay));
    expect(time.mash).toEqual({ total: 76, rests: 55, heating: 21 });
    expect(time.boil).toBe(60);
    expect(time.stages).toEqual([
      { id: "lautering", minutes: 42, rule: "15 min lauter rest + (13 L first wort + 14 L sparge water) ÷ 1 L/min" },
      { id: "heat-to-boil", minutes: 22, rule: "from 78 °C to 100 °C at 1 °C/min" },
      { id: "whirlpool", minutes: 5, rule: "5 min whirlpool" },
      { id: "filtering", minutes: 5, rule: "5 min filtering" },
      { id: "cooling", minutes: 24, rule: "24 L × 1 min/L" },
    ]);
    expect([time.total, time.missing]).toEqual([76 + 42 + 22 + 60 + 5 + 5 + 24, []]);
  });

  it("ACC-114 estimates lautering without sparge water from the first wort, and leaves out an unticked whirlpool", () => {
    const time = brewingTime(recipe({ ...brewDay, boiling: { hops }, water: { mash: 18, target_knockout_volume: 24 } }));
    expect(time.stages.map((s) => [s.id, s.minutes])).toEqual([
      ["lautering", 28],
      ["heat-to-boil", 22],
      ["filtering", 5],
      ["cooling", 24],
    ]);
  });

  it("ACC-114 counts what it can and says which water is missing for the estimates", () => {
    const time = brewingTime(recipe({ mashing: { rests }, boiling: { hops } }));
    expect(time.stages.map((s) => s.id)).toEqual(["heat-to-boil", "filtering"]);
    expect([time.total, time.missing]).toEqual([
      76 + 22 + 60 + 5,
      ["Enter the mash water on the Water tab for the lautering.", "Enter the knockout volume on the Water tab for the cooling."],
    ]);
  });

  it("ACC-112 says what is missing", () => {
    expect(brewingTime(recipe({}))).toEqual({
      mash: undefined,
      boil: undefined,
      stages: [],
      total: undefined,
      missing: ["Plan the rests on the Mashing tab.", "Enter the cooking times on the Boiling tab."],
    });
    // Without a mash schedule there is no lautering and no temperature to heat to the boil from.
    expect(brewingTime(recipe({ boiling: { hops }, water: { mash: 18, target_knockout_volume: 24 } })).stages.map((s) => s.id)).toEqual(["filtering", "cooling"]);
    expect(brewingTime(recipe({ mashing: { rests: { MashIn: { temperature: 57 } } }, boiling: { hops } })).missing[0]).toBe("Plan the rests on the Mashing tab.");
    expect(brewingTime(recipe({ mashing: { rests }, boiling: { hops: [{ name: "H", additions: [{ grams: 5 }] }] } })).missing).toEqual([
      "Enter the cooking times on the Boiling tab.",
      "Enter the mash water on the Water tab for the lautering.",
    ]);
  });
});

describe("the Overview's brew-day timeline (EDT-078, QE-87)", () => {
  it("ACC-113 puts the mash's heating and rests, lautering, heating to the boil, the boil and what follows in time order", () => {
    const rests = { MashIn: { temperature: 57 }, MaltoseRest: { temperature: 63, minutes: 45 }, MashOut: { temperature: 78, minutes: 10 } };
    const timeline = brewDayTimeline(
      recipe({
        mashing: { malts: [{ name: "Pilsner malt", grams: 5000 }], rests },
        boiling: {
          whirlpool: true,
          hops: [{ name: "H", additions: [{ minutes: 60, grams: 20 }, { minutes: 10, grams: 10 }, { grams: 5 }] }, { name: "", additions: [{ minutes: 0, grams: 5 }] }],
          others: [{ name: "Irish Moss", additions: [{ minutes: 10, grams: 5 }] }],
        },
        water: { mash: 18, sparge: 14, target_knockout_volume: 24 },
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
    expect(timeline.stages.map((s) => [s.id, s.from, s.to])).toEqual([
      ["lautering", 76, 118],
      ["heat-to-boil", 118, 140],
      ["whirlpool", 200, 205],
      ["filtering", 205, 210],
      ["cooling", 210, 234],
    ]);
    expect([timeline.boil!.start, timeline.boil!.minutes, timeline.total]).toEqual([140, 60, 234]);
    // In the order they go in; one without a cooking time is left out; one without a name is called by its row.
    expect(timeline.boil!.additions.map((a) => [a.kind, a.row, a.name, a.minute])).toEqual([
      ["hops", 0, "H", 140],
      ["hops", 0, "H", 190],
      ["others", 0, "Irish Moss", 190],
      ["hops", 1, "Hop 2", 200],
    ]);
  });

  it("ACC-113 has only the boil without a mash schedule, only the mash without a boil, and nothing without both", () => {
    const hops = [{ name: "H", additions: [{ minutes: 60, grams: 20 }] }];
    const onlyBoil = brewDayTimeline(recipe({ boiling: { hops } }))!;
    expect([onlyBoil.mash, onlyBoil.boil!.start, onlyBoil.total, onlyBoil.stages.map((s) => s.id)]).toEqual([undefined, 0, 65, ["filtering"]]);
    const onlyMash = brewDayTimeline(recipe({ mashing: { rests: { MashIn: { temperature: 63 }, MaltoseRest: { temperature: 63, minutes: 45 } } } }))!;
    expect([onlyMash.boil, onlyMash.total, onlyMash.mash!.segments.map((s) => s.kind), onlyMash.stages]).toEqual([undefined, 45, ["rest"], []]);
    expect(brewDayTimeline(recipe({}))).toBeUndefined();
  });
});
