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
