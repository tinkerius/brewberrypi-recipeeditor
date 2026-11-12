import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { GOAL_TYPES, MASH_REST_IDS } from "../src/model";
import { validateId, validateRecipe } from "../src/validate";
import schema from "../src/data/recipe.schema.json";
import { SAMPLES } from "../src/samples";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaValid = ajv.compile(schema);

/** The hand-written validator must agree with the schema itself. */
function expectSameVerdict(recipe: unknown) {
  const ours = validateRecipe(recipe);
  expect(ours.length === 0, JSON.stringify({ recipe, ours, ajv: schemaValid.errors })).toBe(schemaValid(recipe));
  return ours;
}

/** A recipe with these goals. */
const r = (goals: unknown, extra: object = {}) => ({ version: 3, name: "x", mashing_process: { goals }, ...extra });

const valid = r([{ type: "HeatUp", temperature: 62 }]);

const CASES: [string, unknown][] = [
  ["valid", valid],
  ["without version", { name: "x", mashing_process: { goals: [{ type: "MashIn" }] } }],
  ["version 1 (the editor writes 3)", { ...valid, version: 1 }],
  ["version 2 (the editor writes 3)", { ...valid, version: 2 }],
  ["version 4", { ...valid, version: 4 }],
  ["mashing plan (app RCP-012)", { ...valid, mashing: { MaltoseRest: { temperature: 63, minutes: 45 }, MashOut: { temperature: 78, minutes: 10 } } }],
  ["mashing plan with every rest", { ...valid, mashing: Object.fromEntries(MASH_REST_IDS.map((id) => [id, { temperature: 0, minutes: 0 }])) }],
  ["empty mashing plan", { ...valid, mashing: {} }],
  ["rest outside its typical range (only a warning)", { ...valid, mashing: { MashOut: { temperature: 95, minutes: 10 } } }],
  ["mashing plan not an object", { ...valid, mashing: [] }],
  ["mashing plan as a string", { ...valid, mashing: "MaltoseRest" }],
  ["unknown rest", { ...valid, mashing: { MainRest: { temperature: 63, minutes: 45 } } }],
  ["rest not an object", { ...valid, mashing: { MaltoseRest: 63 } }],
  ["rest without temperature", { ...valid, mashing: { MaltoseRest: { minutes: 45 } } }],
  ["rest without minutes", { ...valid, mashing: { MaltoseRest: { temperature: 63 } } }],
  ["rest temperature above 110", { ...valid, mashing: { MaltoseRest: { temperature: 111, minutes: 45 } } }],
  ["rest temperature as string", { ...valid, mashing: { MaltoseRest: { temperature: "63", minutes: 45 } } }],
  ["rest minutes not whole", { ...valid, mashing: { MaltoseRest: { temperature: 63, minutes: 4.5 } } }],
  ["rest minutes negative", { ...valid, mashing: { MaltoseRest: { temperature: 63, minutes: -1 } } }],
  ["extra field in a rest", { ...valid, mashing: { MaltoseRest: { temperature: 63, minutes: 45, name: "Maltoserast" } } }],
  ["with $schema", { $schema: "../recipe.schema.json", ...valid }],
  ["all goal types", r([
    { type: "PourInBrewingWater" },
    { type: "HeatUp", temperature: 0 },
    { type: "MashIn" },
    { type: "Rest", temperature: 110, minutes: 0 },
    { type: "Rest", temperature: 62.5, minutes: 30, name: "R", description: "D" },
    { type: "IodineTest", temperature: 68, minutes: 10 },
    { type: "Lautering" },
    { type: "HeatUpForHopsCooking" },
    { type: "CookWater", name: "Cook", description: "Cook 60", minutes: 60 },
  ])],
  ["not an object", []],
  ["string", "x"],
  ["version 0", { ...valid, version: 0 }],
  ["version as string", { ...valid, version: "1" }],
  ["old flat format", { name: "x", goals: [{ type: "MashIn" }] }],
  ["old goals next to mashing_process", { ...valid, goals: [{ type: "MashIn" }] }],
  ["no name", { version: 3, mashing_process: valid.mashing_process }],
  ["empty name", { ...valid, name: "" }],
  ["name not a string", { ...valid, name: 3 }],
  ["no mashing_process", { version: 3, name: "x" }],
  ["mashing_process not an object", { version: 3, name: "x", mashing_process: [] }],
  ["mashing_process without goals", { version: 3, name: "x", mashing_process: {} }],
  ["extra field in mashing_process", { version: 3, name: "x", mashing_process: { goals: [{ type: "MashIn" }], hops: [] } }],
  ["empty goals (app Q-34)", r([])],
  ["goals not an array", r({})],
  ["extra top-level field", { ...valid, grain_bill: {} }],
  ["$schema not a string", { ...valid, $schema: 1 }],
  ["goal not an object", r([1])],
  ["goal without type", r([{}])],
  ["unknown goal type", r([{ type: "Boil" }])],
  ["HeatUp without temperature", r([{ type: "HeatUp" }])],
  ["temperature too high", r([{ type: "HeatUp", temperature: 110.5 }])],
  ["temperature negative", r([{ type: "HeatUp", temperature: -1 }])],
  ["temperature a string", r([{ type: "HeatUp", temperature: "62" }])],
  ["minutes fractional", r([{ type: "Rest", temperature: 62, minutes: 1.5 }])],
  ["minutes negative", r([{ type: "Rest", temperature: 62, minutes: -1 }])],
  ["Rest with name only", r([{ type: "Rest", temperature: 62, minutes: 1, name: "R" }])],
  ["Rest with description only", r([{ type: "Rest", temperature: 62, minutes: 1, description: "D" }])],
  ["Rest with empty name", r([{ type: "Rest", temperature: 62, minutes: 1, name: "", description: "D" }])],
  ["field not allowed for the type", r([{ type: "MashIn", temperature: 50 }])],
  ["IodineTest with a name", r([{ type: "IodineTest", temperature: 68, minutes: 10, name: "I" }])],
  ["CookWater without description", r([{ type: "CookWater", name: "C", minutes: 10 }])],
  // The ingredients (app RCP-013)
  ["ingredients: malts and hops", { ...valid, ingredients: { malts: [{ name: "Pilsner malt", grams: 4500 }], hops: [{ name: "Saaz", additions: [{ minutes: 60, grams: 30 }] }] } }],
  ["ingredients: empty", { ...valid, ingredients: {} }],
  ["ingredients: empty list", { ...valid, ingredients: { hops: [] } }],
  ["ingredients: same name twice", { ...valid, ingredients: { malts: [{ name: "M", grams: 1 }, { name: "M", grams: 2 }] } }],
  ["ingredients not an object", { ...valid, ingredients: [] }],
  ["ingredients: unknown list", { ...valid, ingredients: { grains: [] } }],
  ["ingredients: list not an array", { ...valid, ingredients: { malts: {} } }],
  ["ingredients: entry not an object", { ...valid, ingredients: { malts: ["Pilsner malt"] } }],
  ["ingredients: no name", { ...valid, ingredients: { malts: [{ grams: 4500 }] } }],
  ["ingredients: empty name", { ...valid, ingredients: { malts: [{ name: "", grams: 4500 }] } }],
  ["ingredients: name not a string", { ...valid, ingredients: { malts: [{ name: 1, grams: 4500 }] } }],
  ["ingredients: no grams", { ...valid, ingredients: { malts: [{ name: "Pils" }] } }],
  ["ingredients: 0 g", { ...valid, ingredients: { malts: [{ name: "Pils", grams: 0 }] } }],
  ["ingredients: fractional grams", { ...valid, ingredients: { malts: [{ name: "Pils", grams: 12.5 }] } }],
  ["ingredients: grams a string", { ...valid, ingredients: { malts: [{ name: "Pils", grams: "30" }] } }],
  ["ingredients: extra field", { ...valid, ingredients: { hops: [{ name: "Saaz", additions: [{ grams: 30 }], percent: 100 }] } }],
  // Additions of hops and other additions (app RCP-013, Q-43)
  ["hop with two additions", { ...valid, ingredients: { hops: [{ name: "H", alpha: 12, additions: [{ minutes: 60, grams: 20 }, { grams: 10 }] }] } }],
  ["hop without additions", { ...valid, ingredients: { hops: [{ name: "H", alpha: 12 }] } }],
  ["hop with empty additions", { ...valid, ingredients: { hops: [{ name: "H", additions: [] }] } }],
  ["hop additions not a list", { ...valid, ingredients: { hops: [{ name: "H", additions: { grams: 1 } }] } }],
  ["addition not an object", { ...valid, ingredients: { hops: [{ name: "H", additions: [5] }] } }],
  ["addition without grams", { ...valid, ingredients: { hops: [{ name: "H", additions: [{ minutes: 60 }] }] } }],
  ["addition 0 g", { ...valid, ingredients: { hops: [{ name: "H", additions: [{ grams: 0 }] }] } }],
  ["addition fractional grams", { ...valid, ingredients: { hops: [{ name: "H", additions: [{ grams: 1.5 }] }] } }],
  ["addition with another field", { ...valid, ingredients: { hops: [{ name: "H", additions: [{ grams: 1, alpha: 5 }] }] } }],
  ["hop with its own grams", { ...valid, ingredients: { hops: [{ name: "H", grams: 10, additions: [{ grams: 1 }] }] } }],
  ["hop with its own minutes", { ...valid, ingredients: { hops: [{ name: "H", minutes: 60, additions: [{ grams: 1 }] }] } }],
  // Colour, alpha acid, boil time and the batch (app RCP-013, RCP-014, Q-39)
  ["malt with EBC", { ...valid, ingredients: { malts: [{ name: "M", grams: 1, ebc: 3.5 }, { name: "Rice", grams: 1, ebc: 0 }] } }],
  ["malt EBC negative", { ...valid, ingredients: { malts: [{ name: "M", grams: 1, ebc: -1 }] } }],
  ["malt EBC a string", { ...valid, ingredients: { malts: [{ name: "M", grams: 1, ebc: "3" }] } }],
  ["malt with alpha", { ...valid, ingredients: { malts: [{ name: "M", grams: 1, alpha: 5 }] } }],
  ["hop with alpha and minutes", { ...valid, ingredients: { hops: [{ name: "H", alpha: 5.5, additions: [{ minutes: 60, grams: 1 }] }, { name: "D", alpha: 100, additions: [{ minutes: 0, grams: 1 }] }] } }],
  ["hop alpha 0", { ...valid, ingredients: { hops: [{ name: "H", alpha: 0, additions: [{ grams: 1 }] }] } }],
  ["hop alpha above 100", { ...valid, ingredients: { hops: [{ name: "H", alpha: 100.5, additions: [{ grams: 1 }] }] } }],
  ["hop alpha negative", { ...valid, ingredients: { hops: [{ name: "H", alpha: -0.1, additions: [{ grams: 1 }] }] } }],
  ["hop alpha a string", { ...valid, ingredients: { hops: [{ name: "H", alpha: "5", additions: [{ grams: 1 }] }] } }],
  ["hop minutes fractional", { ...valid, ingredients: { hops: [{ name: "H", additions: [{ grams: 1, minutes: 1.5 }] }] } }],
  ["hop minutes negative", { ...valid, ingredients: { hops: [{ name: "H", additions: [{ grams: 1, minutes: -1 }] }] } }],
  ["hop with EBC", { ...valid, ingredients: { hops: [{ name: "H", ebc: 3, additions: [{ grams: 1 }] }] } }],
  ["batch", { ...valid, batch: { liters: 20, plato: 12.6 } }],
  ["batch empty", { ...valid, batch: {} }],
  ["batch liters only", { ...valid, batch: { liters: 0.5 } }],
  ["batch plato 0 and 40", { ...valid, batch: { plato: 0 } }],
  ["batch plato 40", { ...valid, batch: { plato: 40 } }],
  ["batch not an object", { ...valid, batch: [] }],
  ["batch extra field", { ...valid, batch: { gallons: 5 } }],
  ["batch liters 0", { ...valid, batch: { liters: 0 } }],
  ["batch liters negative", { ...valid, batch: { liters: -20 } }],
  ["batch liters a string", { ...valid, batch: { liters: "20" } }],
  ["batch plato negative", { ...valid, batch: { plato: -1 } }],
  ["batch plato above 40", { ...valid, batch: { plato: 40.5 } }],
  // The final gravity (app RCP-014, Q-41)
  ["batch final_plato", { ...valid, batch: { plato: 12.6, final_plato: 2.5 } }],
  ["batch final_plato 0", { ...valid, batch: { final_plato: 0 } }],
  ["batch final_plato above 40", { ...valid, batch: { final_plato: 40.5 } }],
  ["batch final_plato negative", { ...valid, batch: { final_plato: -0.1 } }],
  ["batch final_plato a string", { ...valid, batch: { final_plato: "2.5" } }],
  // Other boil additions (app RCP-013, Q-42)
  ["other additions", { ...valid, ingredients: { others: [{ name: "Irish Moss", additions: [{ minutes: 5, grams: 10 }] }, { name: "Coriander", additions: [{ grams: 15 }] }] } }],
  ["other additions empty", { ...valid, ingredients: { others: [] } }],
  ["other addition with alpha", { ...valid, ingredients: { others: [{ name: "Irish Moss", alpha: 5, additions: [{ grams: 10 }] }] } }],
  ["other addition with EBC", { ...valid, ingredients: { others: [{ name: "Irish Moss", ebc: 3, additions: [{ grams: 10 }] }] } }],
  ["other addition without grams", { ...valid, ingredients: { others: [{ name: "Irish Moss", additions: [{ minutes: 5 }] }] } }],
  ["other addition fractional minutes", { ...valid, ingredients: { others: [{ name: "Irish Moss", additions: [{ grams: 10, minutes: 2.5 }] }] } }],
  ["other additions not a list", { ...valid, ingredients: { others: {} } }],
  // The water (app RCP-015, Q-40)
  ["water", { ...valid, water: { mash: 16, sparge: 14, top_up: 2 } }],
  ["water empty", { ...valid, water: {} }],
  ["water top_up 0", { ...valid, water: { top_up: 0 } }],
  ["water decimals", { ...valid, water: { sparge: 14.5 } }],
  ["water not an object", { ...valid, water: 16 }],
  ["water extra field", { ...valid, water: { strike: 16 } }],
  ["water negative", { ...valid, water: { mash: -1 } }],
  ["water a string", { ...valid, water: { sparge: "14" } }],
  ["water null", { ...valid, water: { top_up: null } }],
  // The water treatment (app RCP-015, Q-46)
  ["water treatment", { ...valid, water: { treatment: { alkalinity: 10.3, carbonate_hardness: 14, boil: true, gypsum: 1.5, acid_malt: 1, lactic_acid: 0.5 } } }],
  ["water treatment negative alkalinity", { ...valid, water: { treatment: { alkalinity: -2.5 } } }],
  ["water treatment empty", { ...valid, water: { treatment: {} } }],
  ["water treatment not an object", { ...valid, water: { treatment: [] } }],
  ["water treatment extra field", { ...valid, water: { treatment: { hardness: 14 } } }],
  ["water treatment alkalinity a string", { ...valid, water: { treatment: { alkalinity: "10.3" } } }],
  ["water treatment negative hardness", { ...valid, water: { treatment: { carbonate_hardness: -1 } } }],
  ["water treatment negative gypsum", { ...valid, water: { treatment: { gypsum: -0.5 } } }],
  ["water treatment acid malt above 100", { ...valid, water: { treatment: { acid_malt: 101 } } }],
  ["water treatment boil a string", { ...valid, water: { treatment: { boil: "yes" } } }],
  ["water treatment boil without carbonate hardness", { ...valid, water: { treatment: { boil: true } } }],
  ["water treatment boil with carbonate hardness", { ...valid, water: { treatment: { boil: true, carbonate_hardness: 14 } } }],
  ["water treatment boil false without carbonate hardness", { ...valid, water: { treatment: { boil: false } } }],
  ["water treatment negative lactic acid", { ...valid, water: { treatment: { lactic_acid: -1 } } }],
  ["water treatment step ticked without amount", { ...valid, water: { treatment: { gypsum: null } } }],
  ["water treatment acid malt ticked without share", { ...valid, water: { treatment: { acid_malt: null } } }],
  // The description (app RCP-016, Q-44)
  ["description", { ...valid, description: "A wheat beer." }],
  ["description multi-line", { ...valid, description: "Line one.\nLine two." }],
  ["description empty", { ...valid, description: "" }],
  ["description a number", { ...valid, description: 1 }],
  ["description null", { ...valid, description: null }],
  // The fermentation (app RCP-017, Q-45)
  ["fermentation", { ...valid, fermentation: { yeast: { name: "WB-06", grams: 11.5 }, co2: 6.5 } }],
  ["fermentation empty", { ...valid, fermentation: {} }],
  ["fermentation yeast without grams", { ...valid, fermentation: { yeast: { name: "WB-06" } } }],
  ["fermentation co2 only", { ...valid, fermentation: { co2: 5 } }],
  ["fermentation not an object", { ...valid, fermentation: [] }],
  ["fermentation extra field", { ...valid, fermentation: { temperature: 18 } }],
  ["fermentation yeast without name", { ...valid, fermentation: { yeast: { grams: 11.5 } } }],
  ["fermentation yeast empty name", { ...valid, fermentation: { yeast: { name: "" } } }],
  ["fermentation yeast grams 0", { ...valid, fermentation: { yeast: { name: "WB-06", grams: 0 } } }],
  ["fermentation yeast grams a string", { ...valid, fermentation: { yeast: { name: "WB-06", grams: "11.5" } } }],
  ["fermentation yeast extra field", { ...valid, fermentation: { yeast: { name: "WB-06", kind: "dry" } } }],
  ["fermentation yeast a string", { ...valid, fermentation: { yeast: "WB-06" } }],
  ["fermentation co2 0", { ...valid, fermentation: { co2: 0 } }],
  ["fermentation co2 a string", { ...valid, fermentation: { co2: "6.5" } }],
];

describe("validateRecipe", () => {
  it.each(CASES)("ACC-001 agrees with the schema: %s", (_label, recipe) => {
    expectSameVerdict(recipe);
  });

  it("ACC-008 accepts the app's shipped recipes, and only those are the samples", () => {
    expect(SAMPLES.map((s) => s.id)).toEqual(["BENIWEISS", "WaterBoil"]);
    for (const sample of SAMPLES) {
      expect(expectSameVerdict(sample.recipe), sample.id).toEqual([]);
    }
  });

  it("knows the schema's goal types", () => {
    const branches = schema.$defs.goal.properties.type.enum;
    expect([...GOAL_TYPES].sort()).toEqual([...branches].sort());
  });

  it("ACC-001 points at the goal field", () => {
    expect(validateRecipe(r([{ type: "HeatUp" }, { type: "HeatUp", temperature: 200 }]))).toEqual([
      { path: "mashing_process.goals[0].temperature", message: "A Heat Up goal needs a temperature." },
      { path: "mashing_process.goals[1].temperature", message: "Temperature must be between 0 and 110 °C." },
    ]);
  });

  it("ACC-001 explains the old format", () => {
    expect(validateRecipe({ name: "x", goals: [] }).map((p) => p.message)).toContain(
      'Old recipe format: the goals belong into "mashing_process".',
    );
  });
});

describe("validateId", () => {
  it.each(["BENIWEISS", "WaterBoil", "my-recipe_2"])("ACC-002 accepts %s", (id) => {
    expect(validateId(id)).toEqual([]);
  });
  it.each(["", "with space", "umlaut-ä", "dot.json", "../x"])("ACC-002 rejects %j", (id) => {
    expect(validateId(id)).toHaveLength(1);
  });
});
