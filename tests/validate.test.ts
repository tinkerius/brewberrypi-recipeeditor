import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { GOAL_TYPES } from "../src/model";
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

const valid = { name: "Test", goals: [{ type: "HeatUp", temperature: 62 }] };

const CASES: [string, unknown][] = [
  ["valid", valid],
  ["with $schema", { ...valid, $schema: "../recipe.schema.json" }],
  ["all goal types", {
    name: "All",
    goals: [
      { type: "PourInBrewingWater" },
      { type: "HeatUp", temperature: 0 },
      { type: "MashIn" },
      { type: "Rest", temperature: 110, minutes: 0 },
      { type: "Rest", temperature: 62.5, minutes: 30, name: "R", description: "D" },
      { type: "IodineTest", temperature: 68, minutes: 10 },
      { type: "Lautering" },
      { type: "HeatUpForHopsCooking" },
      { type: "CookWater", name: "Cook", description: "Cook 60", minutes: 60 },
    ],
  }],
  ["not an object", []],
  ["string", "x"],
  ["no name", { goals: valid.goals }],
  ["empty name", { name: "", goals: valid.goals }],
  ["name not a string", { name: 3, goals: valid.goals }],
  ["no goals", { name: "x" }],
  ["empty goals", { name: "x", goals: [] }],
  ["goals not an array", { name: "x", goals: {} }],
  ["extra top-level field", { ...valid, id: "x" }],
  ["$schema not a string", { ...valid, $schema: 1 }],
  ["goal not an object", { name: "x", goals: [1] }],
  ["goal without type", { name: "x", goals: [{}] }],
  ["unknown goal type", { name: "x", goals: [{ type: "Boil" }] }],
  ["HeatUp without temperature", { name: "x", goals: [{ type: "HeatUp" }] }],
  ["temperature too high", { name: "x", goals: [{ type: "HeatUp", temperature: 110.5 }] }],
  ["temperature negative", { name: "x", goals: [{ type: "HeatUp", temperature: -1 }] }],
  ["temperature a string", { name: "x", goals: [{ type: "HeatUp", temperature: "62" }] }],
  ["minutes fractional", { name: "x", goals: [{ type: "Rest", temperature: 62, minutes: 1.5 }] }],
  ["minutes negative", { name: "x", goals: [{ type: "Rest", temperature: 62, minutes: -1 }] }],
  ["Rest with name only", { name: "x", goals: [{ type: "Rest", temperature: 62, minutes: 1, name: "R" }] }],
  ["Rest with description only", { name: "x", goals: [{ type: "Rest", temperature: 62, minutes: 1, description: "D" }] }],
  ["Rest with empty name", { name: "x", goals: [{ type: "Rest", temperature: 62, minutes: 1, name: "", description: "D" }] }],
  ["field not allowed for the type", { name: "x", goals: [{ type: "MashIn", temperature: 50 }] }],
  ["IodineTest with a name", { name: "x", goals: [{ type: "IodineTest", temperature: 68, minutes: 10, name: "I" }] }],
  ["CookWater without description", { name: "x", goals: [{ type: "CookWater", name: "C", minutes: 10 }] }],
];

describe("validateRecipe", () => {
  it.each(CASES)("agrees with the schema: %s", (_label, recipe) => {
    expectSameVerdict(recipe);
  });

  it("accepts every sample recipe", () => {
    expect(SAMPLES.length).toBe(8);
    for (const sample of SAMPLES) {
      expect(expectSameVerdict(sample.recipe), sample.id).toEqual([]);
    }
  });

  it("knows the schema's goal types", () => {
    const branches = schema.$defs.goal.properties.type.enum;
    expect([...GOAL_TYPES].sort()).toEqual([...branches].sort());
  });

  it("points at the goal field", () => {
    expect(validateRecipe({ name: "x", goals: [{ type: "HeatUp" }, { type: "HeatUp", temperature: 200 }] })).toEqual([
      { path: "goals[0].temperature", message: "A HeatUp goal needs a temperature." },
      { path: "goals[1].temperature", message: "Temperature must be between 0 and 110 °C." },
    ]);
  });
});

describe("validateId", () => {
  it.each(["HIPA", "WaterBoil", "my-recipe_2"])("accepts %s", (id) => {
    expect(validateId(id)).toEqual([]);
  });
  it.each(["", "with space", "umlaut-ä", "dot.json", "../x"])("rejects %j", (id) => {
    expect(validateId(id)).toHaveLength(1);
  });
});
