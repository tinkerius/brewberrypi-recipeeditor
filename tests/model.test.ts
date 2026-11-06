import { describe, expect, it } from "vitest";
import { changeGoalType, emptyRecipe, goalFields, newGoal, readRecipe, serializeRecipe, toRecipe, GOAL_TYPES } from "../src/model";
import { freeId, fingerprint, hasPendingChanges, newDoc, problemsOf } from "../src/doc";
import { validateRecipe } from "../src/validate";

const RECIPE_FILES = import.meta.glob<string>("../src/data/recipes/*.json", { query: "?raw", import: "default", eager: true });

describe("serializeRecipe", () => {
  it("ACC-003 writes the sample recipes as they are, without $schema", () => {
    expect(Object.keys(RECIPE_FILES)).toHaveLength(2);
    for (const [file, text] of Object.entries(RECIPE_FILES)) {
      const expected = text.replace(/^ {2}"\$schema": .*\n/m, "");
      expect(serializeRecipe(toRecipe(JSON.parse(text))), file).toBe(expected);
    }
  });

  it("ACC-003 writes an empty recipe", () => {
    expect(serializeRecipe(emptyRecipe())).toBe('{\n  "version": 2,\n  "name": "",\n  "mashing_process": {\n    "goals": []\n  }\n}\n');
  });

  it("ACC-003 round-trips", () => {
    const recipe = {
      version: 2,
      name: "Ä \"quoted\"",
      mashing_process: { goals: [{ type: "Rest", temperature: 62.5, minutes: 30, name: "R", description: "D\nE" }] },
    };
    expect(JSON.parse(serializeRecipe(recipe))).toEqual(recipe);
    const odd = { version: 2, name: "N", mashing_process: { goals: [], extra: 1 }, other: true };
    expect(JSON.parse(serializeRecipe(odd))).toEqual(odd);
  });
});

describe("readRecipe", () => {
  it("ACC-007 keeps unknown fields so the validator can report them", () => {
    const recipe = toRecipe({ id: "X", version: 2, name: "N", mashing_process: { goals: [{ type: "HeatUp", temperature: 50, extra: 1 }] } });
    expect(recipe.id).toBe("X");
    expect(validateRecipe(recipe).map((p) => p.path)).toEqual(["id", "mashing_process.goals[0].extra"]);
  });

  it("makes something editable of anything", () => {
    expect(toRecipe(null)).toEqual(emptyRecipe());
    expect(toRecipe({ name: 5, mashing_process: { goals: [3, { temperature: 1 }] } })).toEqual({
      version: 2,
      name: "",
      mashing_process: { goals: [{ type: "" }, { type: "", temperature: 1 }] },
    });
  });

  it("ACC-004 writes a file without version or in version 1 as version 2, unchanged otherwise", () => {
    const expected = { recipe: { version: 2, name: "N", mashing_process: { goals: [{ type: "MashIn" }] } }, converted: undefined };
    expect(readRecipe({ name: "N", mashing_process: { goals: [{ type: "MashIn" }] } })).toEqual(expected);
    expect(readRecipe({ version: 1, name: "N", mashing_process: { goals: [{ type: "MashIn" }] } })).toEqual(expected);
  });

  it("ACC-009 accepts a recipe without goals (app Q-34)", () => {
    const read = readRecipe({ version: 2, name: "Draft", mashing_process: { goals: [] } });
    expect(validateRecipe(read.recipe)).toEqual([]);
  });

  it("ACC-005 converts the old format with goals at the top level", () => {
    const read = readRecipe({ $schema: "../recipe.schema.json", name: "Old", goals: [{ type: "HeatUp", temperature: 62 }] });
    expect(read.recipe).toEqual({ version: 2, name: "Old", mashing_process: { goals: [{ type: "HeatUp", temperature: 62 }] } });
    expect(read.converted).toContain('moved into "mashing_process"');
    expect(validateRecipe(read.recipe)).toEqual([]);
  });

  it("writes an invalid format version as the current one, and says so", () => {
    const read = readRecipe({ version: "1", name: "N", mashing_process: { goals: [{ type: "MashIn" }] } });
    expect(read.recipe?.version).toBe(2);
    expect(read.converted).toContain("not valid");
  });

  it("ACC-006 refuses a newer format version instead of losing what it doesn't know", () => {
    const read = readRecipe({ version: 3, name: "N", mashing_process: { goals: [] }, hops: [] });
    expect(read.recipe).toBeUndefined();
    expect(read.error).toContain("format version 3");
  });

  it("keeps goals next to mashing_process for the validator", () => {
    const recipe = toRecipe({ name: "N", mashing_process: { goals: [{ type: "MashIn" }] }, goals: [] });
    expect(validateRecipe(recipe).map((p) => p.path)).toEqual(["goals"]);
  });
});

describe("goals", () => {
  it("ACC-016 presets valid values where it can", () => {
    for (const type of GOAL_TYPES) {
      const problems = validateRecipe({ name: "x", mashing_process: { goals: [newGoal(type)] } });
      expect(problems.length, type).toBe(type === "CookWater" ? 2 : 0);
    }
  });

  it("ACC-016 keeps shared values when the type changes", () => {
    expect(changeGoalType({ type: "Rest", temperature: 70, minutes: 5, name: "R", description: "D" }, "IodineTest")).toEqual({
      type: "IodineTest",
      temperature: 70,
      minutes: 5,
    });
    expect(changeGoalType({ type: "HeatUp", temperature: 70 }, "MashIn")).toEqual({ type: "MashIn" });
  });

  it("ACC-016 lists the fields in file order", () => {
    expect(goalFields("Rest")).toEqual(["temperature", "minutes", "name", "description"]);
    expect(goalFields("CookWater")).toEqual(["minutes", "name", "description"]);
    expect(goalFields("nope")).toEqual([]);
  });
});

describe("docs", () => {
  it("ACC-017 has pending changes until downloaded or saved", () => {
    const doc = newDoc("", emptyRecipe());
    expect(hasPendingChanges(doc)).toBe(true);
    doc.id = "A";
    doc.baseline = fingerprint(doc);
    expect(hasPendingChanges(doc)).toBe(false);
    doc.recipe = { ...doc.recipe, name: "changed" };
    expect(hasPendingChanges(doc)).toBe(true);
  });

  it("a new recipe is incomplete", () => {
    expect(problemsOf(newDoc("", emptyRecipe())).map((p) => p.path)).toEqual(["id", "name"]);
  });

  it("ACC-013 finds a free file name", () => {
    expect(freeId("A", ["B"])).toBe("A");
    expect(freeId("A", ["A", "A-2"])).toBe("A-3");
  });
});
