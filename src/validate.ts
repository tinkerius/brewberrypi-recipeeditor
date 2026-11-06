/**
 * Checks a recipe against data/recipe.schema.json (brewberrypi-app), without a JSON-schema library: the page runs
 * under a strict Content-Security-Policy (no eval). tests/validate.test.ts compares the results with Ajv.
 */

import { FORMAT_VERSION, GOAL_TYPES, ID_PATTERN, isGoalType, type GoalField } from "./model";

export interface Problem {
  /** Where: "" for the whole recipe, "name", "mashing_process.goals", or "mashing_process.goals[2].minutes". */
  path: string;
  message: string;
}

const TOP_LEVEL = new Set(["$schema", "version", "name", "mashing_process"]);
export const GOALS_PATH = "mashing_process.goals";

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
    problems.push({ path: `${at}.type`, message: `Unknown goal type ${JSON.stringify(goal.type)}; known: ${GOAL_TYPES.join(", ")}.` });
    return;
  }
  const rules = GOAL_FIELDS[goal.type];
  for (const key of Object.keys(goal)) {
    if (key !== "type" && !(rules.allowed as string[]).includes(key)) {
      problems.push({ path: `${at}.${key}`, message: `A ${goal.type} goal has no field "${key}".` });
    }
  }
  for (const field of rules.allowed) {
    const value = goal[field];
    if (value === undefined) {
      if (rules.required.includes(field)) {
        problems.push({ path: `${at}.${field}`, message: `A ${goal.type} goal needs ${field === "minutes" ? "minutes" : `a ${field}`}.` });
      }
    } else {
      checkField(field, value, `${at}.${field}`, problems);
    }
  }
  if (goal.type === "Rest" && (goal.name === undefined) !== (goal.description === undefined)) {
    problems.push({ path: at, message: "A Rest needs both a name and a description, or neither." });
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
    if (process.goals.length === 0) {
      problems.push({ path: GOALS_PATH, message: "The recipe needs at least one goal." });
    }
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
