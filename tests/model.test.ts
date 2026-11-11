import { describe, expect, it } from "vitest";
import {
  changeGoalType,
  convertSingleAdditions,
  emptyRecipe,
  entryGrams,
  goalFields,
  goalLine,
  newGoal,
  newMashRest,
  outsideTypicalRange,
  readRecipe,
  serializeRecipe,
  toRecipe,
  withMashRest,
  GOAL_TYPES,
  MASH_REST_IDS,
} from "../src/model";
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
    expect(serializeRecipe(emptyRecipe())).toBe('{\n  "version": 3,\n  "name": "",\n  "mashing_process": {\n    "goals": []\n  }\n}\n');
  });

  it("ACC-003 round-trips", () => {
    const recipe = {
      version: 3,
      name: "Ä \"quoted\"",
      mashing_process: { goals: [{ type: "Rest", temperature: 62.5, minutes: 30, name: "R", description: "D\nE" }] },
    };
    expect(JSON.parse(serializeRecipe(recipe))).toEqual(recipe);
    const odd = { version: 3, name: "N", mashing_process: { goals: [], extra: 1 }, other: true };
    expect(JSON.parse(serializeRecipe(odd))).toEqual(odd);
  });
});

describe("readRecipe", () => {
  it("ACC-007 keeps unknown fields so the validator can report them", () => {
    const recipe = toRecipe({ id: "X", version: 3, name: "N", mashing_process: { goals: [{ type: "HeatUp", temperature: 50, extra: 1 }] } });
    expect(recipe.id).toBe("X");
    expect(validateRecipe(recipe).map((p) => p.path)).toEqual(["id", "mashing_process.goals[0].extra"]);
  });

  it("makes something editable of anything", () => {
    expect(toRecipe(null)).toEqual(emptyRecipe());
    expect(toRecipe({ name: 5, mashing_process: { goals: [3, { temperature: 1 }] } })).toEqual({
      version: 3,
      name: "",
      mashing_process: { goals: [{ type: "" }, { type: "", temperature: 1 }] },
    });
  });

  it("ACC-004 writes a file without version or in version 1 or 2 as version 3, unchanged otherwise", () => {
    const expected = { recipe: { version: 3, name: "N", mashing_process: { goals: [{ type: "MashIn" }] } }, converted: undefined };
    expect(readRecipe({ name: "N", mashing_process: { goals: [{ type: "MashIn" }] } })).toEqual(expected);
    expect(readRecipe({ version: 1, name: "N", mashing_process: { goals: [{ type: "MashIn" }] } })).toEqual(expected);
    expect(readRecipe({ version: 2, name: "N", mashing_process: { goals: [{ type: "MashIn" }] } })).toEqual(expected);
  });

  it("ACC-009 accepts a recipe without goals (app Q-34)", () => {
    const read = readRecipe({ version: 3, name: "Draft", mashing_process: { goals: [] } });
    expect(validateRecipe(read.recipe)).toEqual([]);
  });

  it("ACC-005 converts the old format with goals at the top level", () => {
    const read = readRecipe({ $schema: "../recipe.schema.json", name: "Old", goals: [{ type: "HeatUp", temperature: 62 }] });
    expect(read.recipe).toEqual({ version: 3, name: "Old", mashing_process: { goals: [{ type: "HeatUp", temperature: 62 }] } });
    expect(read.converted).toContain('moved into "mashing_process"');
    expect(validateRecipe(read.recipe)).toEqual([]);
  });

  it("ACC-089 moves a hop's or another addition's own amount and cooking time into its additions, and says so", () => {
    const base = { version: 3, name: "Old hops", mashing_process: { goals: [] } };
    const read = readRecipe({
      ...base,
      ingredients: {
        malts: [{ name: "Pilsner malt", grams: 4500 }],
        hops: [
          { name: "Hallertauer", grams: 15, alpha: 5, minutes: 60 },
          { name: "Saaz", grams: 15, minutes: 60, additions: [{ minutes: 60, grams: 99 }] },
          { name: "Tettnanger", grams: 10, minutes: 5, additions: [{ minutes: 5, grams: 10 }] },
          { name: "Cascade", alpha: 6, additions: [{ minutes: 0, grams: 30 }] },
        ],
        others: [{ name: "Irish Moss", grams: 5 }],
      },
    });
    expect(read.recipe!.ingredients).toEqual({
      malts: [{ name: "Pilsner malt", grams: 4500 }],
      hops: [
        { name: "Hallertauer", alpha: 5, additions: [{ minutes: 60, grams: 15 }] },
        { name: "Saaz", additions: [{ minutes: 60, grams: 15 }, { minutes: 60, grams: 99 }] },
        { name: "Tettnanger", additions: [{ minutes: 5, grams: 10 }] }, // the same addition is not repeated
        { name: "Cascade", alpha: 6, additions: [{ minutes: 0, grams: 30 }] },
      ],
      others: [{ name: "Irish Moss", additions: [{ grams: 5 }] }],
    });
    expect(read.converted).toBe(
      'Converted: hop 1 "Hallertauer": its own amount and cooking time are moved into its additions; ' +
        'hop 2 "Saaz": its own amount and cooking time are moved into its additions; ' +
        'hop 3 "Tettnanger": its own amount and cooking time are moved into its additions; ' +
        'other addition 1 "Irish Moss": its own amount and cooking time are moved into its additions.',
    );
    expect(validateRecipe(read.recipe)).toEqual([]);
    // A recipe in the current shape is not changed.
    const current = { ...base, ingredients: { hops: [{ name: "Cascade", additions: [{ minutes: 0, grams: 30 }] }] } };
    expect(convertSingleAdditions(current as never).changes).toEqual([]);
    expect(readRecipe(current).converted).toBeUndefined();
  });

  it("counts a hop's additions, never an own amount it still has (EDT-061)", () => {
    expect(entryGrams({ name: "H", grams: 15, additions: [{ minutes: 60, grams: 99 }, { grams: 5 }, { grams: 5 }] })).toBe(109);
    expect(entryGrams({ name: "Pilsner malt", grams: 4500 })).toBe(4500);
    expect(entryGrams({ name: "H", additions: [] })).toBe(0);
  });

  it("writes an invalid format version as the current one, and says so", () => {
    const read = readRecipe({ version: "1", name: "N", mashing_process: { goals: [{ type: "MashIn" }] } });
    expect(read.recipe?.version).toBe(3);
    expect(read.converted).toContain("not valid");
  });

  it("ACC-006 refuses a newer format version instead of losing what it doesn't know", () => {
    const read = readRecipe({ version: 4, name: "N", mashing_process: { goals: [] }, hops: [] });
    expect(read.recipe).toBeUndefined();
    expect(read.error).toContain("format version 4");
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

describe("goalLine", () => {
  const text = (goal: Record<string, unknown>) => goalLine(goal as never).map((p) => p.text).join(" ");
  it.each([
    [{ type: "PourInBrewingWater" }, "Add Water"],
    [{ type: "HeatUp", temperature: 62 }, "Heat Up to 62 °C"],
    [{ type: "Rest", temperature: 65, minutes: 30 }, "Rest at 65 °C for 30 min"],
    [{ type: "Rest", temperature: 65, minutes: 30, name: "Maltoserast", description: "d" }, "Rest at 65 °C for 30 min — Maltoserast"],
    [{ type: "CookWater", minutes: 60, name: "", description: "" }, "Cook for 60 min"],
    [{ type: "HeatUp" }, "Heat Up to ? °C"],
    [{ type: "HeatUp", temperature: "62x" }, "Heat Up to 62x °C"],
    [{ type: "Boil" }, "Unknown: Boil"],
  ])("ACC-046 %j reads %s", (goal, expected) => {
    expect(text(goal)).toBe(expected);
  });

  it("ACC-046 marks missing and invalid values", () => {
    expect(goalLine({ type: "HeatUp" }).map((p) => p.kind)).toEqual(["type", "word", "missing"]);
    expect(goalLine({ type: "HeatUp", temperature: "x" }).at(-1)!.kind).toBe("missing");
  });
});

describe("mashing plan (QE-32)", () => {
  it("ACC-059 plans rests with their presets, in table order, one per line, and drops the plan with the last rest", () => {
    const empty = { ...emptyRecipe(), name: "P" };
    const planned = withMashRest(withMashRest(empty, "MashOut", newMashRest("MashOut")), "MaltoseRest", newMashRest("MaltoseRest"));
    expect(planned.mashing).toEqual({ MaltoseRest: { temperature: 63, minutes: 45 }, MashOut: { temperature: 78, minutes: 10 } });
    expect(Object.keys(planned.mashing as object)).toEqual(["MaltoseRest", "MashOut"]);
    expect(validateRecipe(planned)).toEqual([]);
    const text = serializeRecipe(planned);
    expect(text).toBe(
      '{\n  "version": 3,\n  "name": "P",\n  "mashing_process": {\n    "goals": []\n  },\n  "mashing": {\n' +
        '    "MaltoseRest": { "temperature": 63, "minutes": 45 },\n    "MashOut": { "temperature": 78, "minutes": 10 }\n  }\n}\n',
    );
    expect(readRecipe(JSON.parse(text))).toEqual({ recipe: planned, converted: undefined });
    const none = withMashRest(withMashRest(planned, "MaltoseRest", undefined), "MashOut", undefined);
    expect("mashing" in none).toBe(false);
    expect(none).toEqual(empty);
  });

  it("ACC-059 presets every rest inside its typical range", () => {
    for (const id of MASH_REST_IDS) {
      expect(outsideTypicalRange(id, newMashRest(id).temperature), id).toBe(false);
    }
  });

  it("ACC-060 warns only outside the typical range, inclusive", () => {
    expect([59.9, 60, 65, 65.1, 70].map((t) => outsideTypicalRange("MaltoseRest", t))).toEqual([true, false, false, true, true]);
    expect(outsideTypicalRange("MaltoseRest", "6")).toBe(false);
    expect(validateRecipe(withMashRest({ ...emptyRecipe(), name: "P" }, "MaltoseRest", { temperature: 70, minutes: 45 }))).toEqual([]);
  });
});
