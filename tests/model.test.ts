import { describe, expect, it } from "vitest";
import { changeGoalType, emptyRecipe, goalFields, newGoal, serializeRecipe, toRecipe, GOAL_TYPES } from "../src/model";
import { freeId, fingerprint, hasPendingChanges, newDoc, problemsOf } from "../src/doc";
import { validateRecipe } from "../src/validate";

const RECIPE_FILES = import.meta.glob<string>("../src/data/recipes/*.json", { query: "?raw", import: "default", eager: true });

describe("serializeRecipe", () => {
  it("writes the sample recipes as they are, without $schema", () => {
    expect(Object.keys(RECIPE_FILES)).toHaveLength(8);
    for (const [file, text] of Object.entries(RECIPE_FILES)) {
      const expected = text.replace(/^ {2}"\$schema": .*\n/m, "");
      expect(serializeRecipe(toRecipe(JSON.parse(text))), file).toBe(expected);
    }
  });

  it("writes an empty recipe", () => {
    expect(serializeRecipe(emptyRecipe())).toBe('{\n  "name": "",\n  "goals": []\n}\n');
  });

  it("round-trips", () => {
    const recipe = { name: "Ä \"quoted\"", goals: [{ type: "Rest", temperature: 62.5, minutes: 30, name: "R", description: "D\nE" }] };
    expect(JSON.parse(serializeRecipe(recipe))).toEqual(recipe);
  });
});

describe("toRecipe", () => {
  it("keeps unknown fields so the validator can report them", () => {
    const recipe = toRecipe({ id: "X", name: "N", goals: [{ type: "HeatUp", temperature: 50, extra: 1 }] });
    expect(recipe.id).toBe("X");
    expect(validateRecipe(recipe).map((p) => p.path)).toEqual(["id", "goals[0].extra"]);
  });

  it("makes something editable of anything", () => {
    expect(toRecipe(null)).toEqual({ name: "", goals: [] });
    expect(toRecipe({ name: 5, goals: [3, { temperature: 1 }] })).toEqual({ name: "", goals: [{ type: "" }, { type: "", temperature: 1 }] });
  });
});

describe("goals", () => {
  it("presets valid values where it can", () => {
    for (const type of GOAL_TYPES) {
      const problems = validateRecipe({ name: "x", goals: [newGoal(type)] });
      expect(problems.length, type).toBe(type === "CookWater" ? 2 : 0);
    }
  });

  it("keeps shared values when the type changes", () => {
    expect(changeGoalType({ type: "Rest", temperature: 70, minutes: 5, name: "R", description: "D" }, "IodineTest")).toEqual({
      type: "IodineTest",
      temperature: 70,
      minutes: 5,
    });
    expect(changeGoalType({ type: "HeatUp", temperature: 70 }, "MashIn")).toEqual({ type: "MashIn" });
  });

  it("lists the fields in file order", () => {
    expect(goalFields("Rest")).toEqual(["temperature", "minutes", "name", "description"]);
    expect(goalFields("CookWater")).toEqual(["minutes", "name", "description"]);
    expect(goalFields("nope")).toEqual([]);
  });
});

describe("docs", () => {
  it("has pending changes until downloaded or saved", () => {
    const doc = newDoc("", emptyRecipe());
    expect(hasPendingChanges(doc)).toBe(true);
    doc.id = "A";
    doc.baseline = fingerprint(doc);
    expect(hasPendingChanges(doc)).toBe(false);
    doc.recipe = { ...doc.recipe, name: "changed" };
    expect(hasPendingChanges(doc)).toBe(true);
  });

  it("a new recipe is incomplete", () => {
    expect(problemsOf(newDoc("", emptyRecipe())).map((p) => p.path)).toEqual(["id", "name", "goals"]);
  });

  it("finds a free file name", () => {
    expect(freeId("A", ["B"])).toBe("A");
    expect(freeId("A", ["A", "A-2"])).toBe("A-3");
  });
});
