/**
 * Checks a recipe against data/recipe.schema.json (brewberrypi-app), without a JSON-schema library: the page runs
 * under a strict Content-Security-Policy (no eval). tests/validate.test.ts compares the results with Ajv.
 */

import {
  FORMAT_VERSION,
  GOAL_INFO,
  ID_PATTERN,
  INGREDIENT_EXTRA_FIELDS,
  INGREDIENT_KINDS,
  INGREDIENT_LABELS,
  MASH_RESTS,
  isGoalType,
  isMashRestId,
  type GoalField,
  type IngredientKind,
  WATER_FIELDS,
  WATER_LABELS,
} from "./model";

export interface Problem {
  /**
   * Where: "" for the whole recipe, "name", "mashing_process.goals", "mashing_process.goals[2].minutes", "mashing",
   * "mashing.MaltoseRest.temperature", "ingredients",
   * "ingredients.malts[0].grams", "batch" or "batch.liters".
   */
  path: string;
  message: string;
}

const TOP_LEVEL = new Set(["$schema", "version", "name", "description", "mashing_process", "mashing", "ingredients", "batch", "water", "fermentation"]);
export const GOALS_PATH = "mashing_process.goals";
export const MASHING_PATH = "mashing";
export const INGREDIENTS_PATH = "ingredients";
export const BATCH_PATH = "batch";
export const WATER_PATH = "water";

/** Which goal fields are allowed and required, per goal type (the schema's allOf branches). */
const GOAL_FIELDS: Record<string, { required: GoalField[]; allowed: GoalField[] }> = {
  PourInBrewingWater: { required: [], allowed: [] },
  MashIn: { required: [], allowed: [] },
  Lautering: { required: [], allowed: [] },
  HeatUpForHopsCooking: { required: [], allowed: [] },
  HeatUp: { required: ["temperature"], allowed: ["temperature"] },
  Rest: { required: ["temperature", "minutes"], allowed: ["temperature", "minutes", "name", "description"] },
  IodineTest: { required: ["temperature", "minutes"], allowed: ["temperature", "minutes"] },
  CookWater: { required: ["name", "description", "minutes"], allowed: ["name", "description", "minutes"] },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkField(field: GoalField, value: unknown, path: string, problems: Problem[]) {
  switch (field) {
    case "temperature":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        problems.push({ path, message: "Temperature must be a number." });
      } else if (value < 0 || value > 110) {
        problems.push({ path, message: "Temperature must be between 0 and 110 °C." });
      }
      break;
    case "minutes":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        problems.push({ path, message: "Minutes must be a whole number." });
      } else if (value < 0) {
        problems.push({ path, message: "Minutes must not be negative." });
      }
      break;
    case "name":
    case "description":
      if (typeof value !== "string" || value.length === 0) {
        problems.push({ path, message: `${field === "name" ? "Name" : "Description"} must not be empty.` });
      }
      break;
  }
}

function checkGoal(goal: unknown, index: number, problems: Problem[]) {
  const at = `${GOALS_PATH}[${index}]`;
  if (!isObject(goal)) {
    problems.push({ path: at, message: "A goal must be an object." });
    return;
  }
  if (goal.type === undefined) {
    problems.push({ path: `${at}.type`, message: "The goal has no type." });
    return;
  }
  if (!isGoalType(goal.type)) {
    problems.push({ path: `${at}.type`, message: `Unknown goal type ${JSON.stringify(goal.type)}: choose a type with the pencil.` });
    return;
  }
  const rules = GOAL_FIELDS[goal.type];
  // Display names only, never the file's type names (QE-24).
  const label = GOAL_INFO[goal.type].label;
  for (const key of Object.keys(goal)) {
    if (key !== "type" && !(rules.allowed as string[]).includes(key)) {
      problems.push({ path: `${at}.${key}`, message: `A ${label} goal has no field "${key}".` });
    }
  }
  for (const field of rules.allowed) {
    const value = goal[field];
    if (value === undefined) {
      if (rules.required.includes(field)) {
        problems.push({ path: `${at}.${field}`, message: `A ${label} goal needs ${field === "minutes" ? "minutes" : `a ${field}`}.` });
      }
    } else {
      checkField(field, value, `${at}.${field}`, problems);
    }
  }
  if (goal.type === "Rest" && (goal.name === undefined) !== (goal.description === undefined)) {
    problems.push({ path: at, message: "A Rest needs both a name and a description, or neither." });
  }
}

/** The mashing plan (app RCP-012): known rests only, each with exactly a temperature and minutes. */
function checkMashing(plan: unknown, problems: Problem[]) {
  if (!isObject(plan)) {
    problems.push({ path: MASHING_PATH, message: "The mashing plan must be an object of rests." });
    return;
  }
  for (const [id, rest] of Object.entries(plan)) {
    const at = `${MASHING_PATH}.${id}`;
    if (!isMashRestId(id)) {
      problems.push({ path: at, message: `Unknown rest "${id}".` });
      continue;
    }
    const label = MASH_RESTS[id].short;
    if (!isObject(rest)) {
      problems.push({ path: at, message: `The ${label} must be an object with a temperature and minutes.` });
      continue;
    }
    for (const key of Object.keys(rest)) {
      if (key !== "temperature" && key !== "minutes") {
        problems.push({ path: `${at}.${key}`, message: `A rest has no field "${key}".` });
      }
    }
    for (const field of ["temperature", "minutes"] as const) {
      if (rest[field] === undefined) {
        problems.push({ path: `${at}.${field}`, message: `The ${label} needs ${field === "minutes" ? "minutes" : "a temperature"}.` });
      } else {
        checkField(field, rest[field], `${at}.${field}`, problems);
      }
    }
  }
}

/** An amount in whole grams ≥ 1 (app RCP-013): required. */
function checkGrams(grams: unknown, path: string, label: string, problems: Problem[]) {
  if (grams === undefined) {
    problems.push({ path, message: `${label} needs an amount in grams.` });
  } else if (typeof grams !== "number" || !Number.isInteger(grams)) {
    problems.push({ path, message: `${label}: the amount must be a whole number of grams.` });
  } else if (grams < 1) {
    problems.push({ path, message: `${label}: the amount must be at least 1 g.` });
  }
}

function isIngredientKind(key: string): key is IngredientKind {
  return (INGREDIENT_KINDS as readonly string[]).includes(key);
}

/** The ingredients (app RCP-013): the lists malts and hops, each entry exactly a name and whole grams ≥ 1. */
function checkIngredients(ingredients: unknown, problems: Problem[]) {
  if (!isObject(ingredients)) {
    problems.push({ path: INGREDIENTS_PATH, message: "The ingredients must be an object with the lists malts and hops." });
    return;
  }
  for (const [kind, list] of Object.entries(ingredients)) {
    const at = `${INGREDIENTS_PATH}.${kind}`;
    if (!isIngredientKind(kind)) {
      problems.push({ path: at, message: `The ingredients have no list "${kind}".` });
      continue;
    }
    const { one, title } = INGREDIENT_LABELS[kind];
    if (!Array.isArray(list)) {
      problems.push({ path: at, message: `${title} must be a list.` });
      continue;
    }
    list.forEach((entry, i) => {
      const item = `${at}[${i}]`;
      const label = `${one} ${i + 1}`;
      if (!isObject(entry)) {
        problems.push({ path: item, message: `${label} must be an object with a name and grams.` });
        return;
      }
      const extra = INGREDIENT_EXTRA_FIELDS[kind];
      for (const key of Object.keys(entry)) {
        if (key !== "name" && !extra.includes(key)) {
          problems.push({ path: `${item}.${key}`, message: `${label} has no field "${key}".` });
        }
      }
      const number = (value: unknown) => typeof value === "number" && Number.isFinite(value);
      if (entry.ebc !== undefined && extra.includes("ebc") && !(number(entry.ebc) && (entry.ebc as number) >= 0)) {
        problems.push({ path: `${item}.ebc`, message: `${label}: the colour must be a number of at least 0 EBC.` });
      }
      if (entry.alpha !== undefined && extra.includes("alpha")) {
        const alpha = entry.alpha;
        if (!number(alpha) || (alpha as number) < 0 || (alpha as number) > 100) {
          problems.push({ path: `${item}.alpha`, message: `${label}: the alpha acid must be a number from 0 to 100 %.` });
        }
      }
      if (typeof entry.name !== "string" || entry.name.length === 0) {
        problems.push({ path: `${item}.name`, message: `${label} needs a name.` });
      }
      if (kind === "malts") {
        checkGrams(entry.grams, `${item}.grams`, label, problems);
        return;
      }
      // A hop or another addition: at least one addition, each with grams and maybe minutes (app RCP-013, Q-43).
      const additions = entry.additions;
      if (additions === undefined || (Array.isArray(additions) && additions.length === 0)) {
        problems.push({ path: `${item}.additions`, message: `${label} needs an addition.` });
        return;
      }
      if (!Array.isArray(additions)) {
        problems.push({ path: `${item}.additions`, message: `${label}: the additions must be a list.` });
        return;
      }
      additions.forEach((addition, j) => {
        const at = `${item}.additions[${j}]`;
        const name = `${label}, addition ${j + 1}`;
        if (!isObject(addition)) {
          problems.push({ path: at, message: `${name} must be an object with minutes and grams.` });
          return;
        }
        for (const key of Object.keys(addition)) {
          if (key !== "minutes" && key !== "grams") {
            problems.push({ path: `${at}.${key}`, message: `${name} has no field "${key}".` });
          }
        }
        const minutes = addition.minutes;
        if (minutes !== undefined && (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 0)) {
          problems.push({ path: `${at}.minutes`, message: `${name}: the boil time must be a whole number of minutes, at least 0.` });
        }
        checkGrams(addition.grams, `${at}.grams`, name, problems);
      });
    });
  }
}

/** The batch (app RCP-014): the wort volume above 0 litres and the original gravity from 0 to 40 °P. */
function checkBatch(batch: unknown, problems: Problem[]) {
  if (!isObject(batch)) {
    problems.push({ path: BATCH_PATH, message: "The batch must be an object with liters, plato and final_plato." });
    return;
  }
  for (const [key, value] of Object.entries(batch)) {
    const at = `${BATCH_PATH}.${key}`;
    const number = typeof value === "number" && Number.isFinite(value);
    if (key === "liters") {
      if (!number || value <= 0) {
        problems.push({ path: at, message: "The knockout volume must be a number above 0 litres." });
      }
    } else if (key === "plato" || key === "final_plato") {
      if (!number || value < 0 || value > 40) {
        const what = key === "plato" ? "original" : "final";
        problems.push({ path: at, message: `The ${what} gravity must be a number from 0 to 40 °P.` });
      }
    } else {
      problems.push({ path: at, message: `The batch has no field "${key}".` });
    }
  }
}

/** The water (app RCP-015): the mash, sparge and top-up water, each a number of at least 0 litres. */
function checkWater(water: unknown, problems: Problem[]) {
  if (!isObject(water)) {
    problems.push({ path: WATER_PATH, message: "The water must be an object with mash, sparge and top_up." });
    return;
  }
  for (const [key, value] of Object.entries(water)) {
    const at = `${WATER_PATH}.${key}`;
    if (key === "treatment") {
      checkTreatment(value, problems);
    } else if (!(WATER_FIELDS as readonly string[]).includes(key)) {
      problems.push({ path: at, message: `The water has no field "${key}".` });
    } else if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      const label = WATER_LABELS[key as (typeof WATER_FIELDS)[number]].label;
      problems.push({ path: at, message: `The ${label.toLowerCase()} must be a number of at least 0 litres.` });
    }
  }
}

/** The water treatment (app RCP-015, Q-46): the tap water's figures in °dH and what is done to the water. */
function checkTreatment(treatment: unknown, problems: Problem[]) {
  const at = `${WATER_PATH}.treatment`;
  if (!isObject(treatment)) {
    problems.push({ path: at, message: "The water treatment must be an object." });
    return;
  }
  const number = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const messages: Record<string, [(v: unknown) => boolean, string]> = {
    alkalinity: [number, "The residual alkalinity must be a number of °dH."],
    carbonate_hardness: [(v) => number(v) && (v as number) >= 0, "The carbonate hardness must be a number of at least 0 °dH."],
    boil: [(v) => typeof v === "boolean", "Boiling must be yes or no."],
    gypsum: [(v) => number(v) && (v as number) >= 0, "The brewing gypsum must be a number of at least 0 g per 10 L of mash water."],
    acid_malt: [(v) => number(v) && (v as number) >= 0 && (v as number) <= 100, "The acid malt must be a number from 0 to 100 % of the total malt."],
    lactic_acid: [(v) => number(v) && (v as number) >= 0, "The lactic acid must be a number of at least 0 ml per 10 L of mash water."],
  };
  // A ticked step whose amount is not entered yet (EDT-069, `null`).
  const needs: Record<string, string> = {
    gypsum: "The brewing gypsum needs an amount.",
    acid_malt: "The acid malt needs its share of the total malt.",
    lactic_acid: "The lactic acid needs an amount.",
  };
  // Boiling works only by way of the tap water's carbonate hardness: it is required then (app Q-47).
  if (treatment.boil === true && !("carbonate_hardness" in treatment)) {
    problems.push({ path: `${at}.carbonate_hardness`, message: "Boiling the mash water needs the tap water's carbonate hardness." });
  }
  for (const [key, value] of Object.entries(treatment)) {
    const check = messages[key];
    if (value === null && key in needs) {
      problems.push({ path: `${at}.${key}`, message: needs[key] });
    } else if (!check) {
      problems.push({ path: `${at}.${key}`, message: `The water treatment has no field "${key}".` });
    } else if (!check[0](value)) {
      problems.push({ path: `${at}.${key}`, message: check[1] });
    }
  }
}

/** The fermentation (app RCP-017, Q-45): the yeast with its name and maybe grams, the target carbonation. */
function checkFermentation(fermentation: unknown, problems: Problem[]) {
  if (!isObject(fermentation)) {
    problems.push({ path: "fermentation", message: "The fermentation must be an object with the yeast and the CO₂ target." });
    return;
  }
  const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
  for (const [key, value] of Object.entries(fermentation)) {
    if (key === "co2") {
      if (!positive(value)) {
        problems.push({ path: "fermentation.co2", message: "The CO₂ target must be a number above 0 g/L." });
      }
    } else if (key === "yeast") {
      if (!isObject(value)) {
        problems.push({ path: "fermentation.yeast", message: "The yeast must be an object with a name." });
        continue;
      }
      for (const field of Object.keys(value)) {
        if (field !== "name" && field !== "grams") {
          problems.push({ path: `fermentation.yeast.${field}`, message: `The yeast has no field "${field}".` });
        }
      }
      if (typeof value.name !== "string" || value.name.length === 0) {
        problems.push({ path: "fermentation.yeast.name", message: "The yeast needs a name." });
      }
      if (value.grams !== undefined && !positive(value.grams)) {
        problems.push({ path: "fermentation.yeast.grams", message: "The yeast's amount must be a number above 0 g." });
      }
    } else {
      problems.push({ path: `fermentation.${key}`, message: `The fermentation has no field "${key}".` });
    }
  }
}

/** All problems of a recipe; an empty list means the app will load it. */
export function validateRecipe(recipe: unknown): Problem[] {
  const problems: Problem[] = [];
  if (!isObject(recipe)) {
    return [{ path: "", message: "A recipe must be a JSON object." }];
  }
  for (const key of Object.keys(recipe)) {
    if (key === "goals") {
      problems.push({ path: key, message: 'Old recipe format: the goals belong into "mashing_process".' });
    } else if (!TOP_LEVEL.has(key)) {
      problems.push({ path: key, message: `A recipe has no field "${key}".` });
    }
  }
  if ("$schema" in recipe && typeof recipe.$schema !== "string") {
    problems.push({ path: "$schema", message: "$schema must be a string." });
  }
  if ("version" in recipe && recipe.version !== FORMAT_VERSION) {
    problems.push({ path: "version", message: `The recipe file format version must be ${FORMAT_VERSION}.` });
  }
  if (typeof recipe.name !== "string" || recipe.name.length === 0) {
    problems.push({ path: "name", message: "The recipe needs a name." });
  }
  // The brewer's free text (app RCP-016, Q-44): any text, also several lines or empty.
  if ("description" in recipe && typeof recipe.description !== "string") {
    problems.push({ path: "description", message: "The description must be text." });
  }
  if ("mashing" in recipe) {
    checkMashing(recipe.mashing, problems);
  }
  if ("ingredients" in recipe) {
    checkIngredients(recipe.ingredients, problems);
  }
  if ("batch" in recipe) {
    checkBatch(recipe.batch, problems);
  }
  if ("water" in recipe) {
    checkWater(recipe.water, problems);
  }
  if ("fermentation" in recipe) {
    checkFermentation(recipe.fermentation, problems);
  }
  const process = recipe.mashing_process;
  if (!isObject(process)) {
    problems.push({ path: "mashing_process", message: "The recipe needs a mashing process with goals." });
    return problems;
  }
  for (const key of Object.keys(process)) {
    if (key !== "goals") {
      problems.push({ path: `mashing_process.${key}`, message: `The mashing process has no field "${key}".` });
    }
  }
  if (!Array.isArray(process.goals)) {
    problems.push({ path: GOALS_PATH, message: "The recipe needs a list of goals." });
  } else {
    process.goals.forEach((goal, i) => checkGoal(goal, i, problems));
  }
  return problems;
}

/** Problems of a recipe id, which is also the file name without ".json" (spec RCP-001). */
export function validateId(id: string): Problem[] {
  if (id.length === 0) {
    return [{ path: "id", message: "The recipe needs a file name." }];
  }
  if (!ID_PATTERN.test(id)) {
    return [{ path: "id", message: "The file name may only contain letters A–Z, digits, _ and -." }];
  }
  return [];
}
