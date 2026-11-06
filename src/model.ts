/**
 * Recipe and goal types: the recipe file format of brewberrypi-app (data/recipe.schema.json, spec 04 and 07 §7.2):
 * { "version": 1, "name": …, "mashing_process": { "goals": […] } }, one recipe per file, the file name is the id.
 */

/** The recipe file format version this editor reads and writes (RCP-008: the app's latest version). */
export const FORMAT_VERSION = 1;

export const GOAL_TYPES = [
  "PourInBrewingWater",
  "HeatUp",
  "MashIn",
  "Rest",
  "IodineTest",
  "Lautering",
  "HeatUpForHopsCooking",
  "CookWater",
] as const;

export type GoalType = (typeof GOAL_TYPES)[number];

export type GoalField = "temperature" | "minutes" | "name" | "description";

/** A goal as it is edited: known fields, plus whatever an uploaded file contained (reported by the validator). */
export type Goal = { type: string } & Partial<Record<GoalField, unknown>> & Record<string, unknown>;

export interface MashingProcess {
  goals: Goal[];
  [key: string]: unknown;
}

export interface Recipe {
  version?: unknown;
  name: string;
  mashing_process: MashingProcess;
  [key: string]: unknown;
}

export function goalsOf(recipe: Recipe): Goal[] {
  return recipe.mashing_process.goals;
}

export function withGoals(recipe: Recipe, goals: Goal[]): Recipe {
  return { ...recipe, mashing_process: { ...recipe.mashing_process, goals } };
}

export interface GoalInfo {
  /** Display name in the app (spec 04, table 4.1). */
  label: string;
  /** What the goal does, in a few words, for the editor. */
  summary: string;
  required: GoalField[];
  optional: GoalField[];
}

export const GOAL_INFO: Record<GoalType, GoalInfo> = {
  PourInBrewingWater: {
    label: "Add Water",
    summary: "Asks the brewer to pour in the brewing water.",
    required: [],
    optional: [],
  },
  HeatUp: { label: "Heat Up", summary: "Heats the mash to the temperature.", required: ["temperature"], optional: [] },
  MashIn: { label: "Mash In", summary: "Asks the brewer to mash in the malt.", required: [], optional: [] },
  Rest: {
    label: "Rest",
    summary: "Holds the temperature for the minutes. Name and description: both or neither.",
    required: ["temperature", "minutes"],
    optional: ["name", "description"],
  },
  IodineTest: {
    label: "Iodine Test",
    summary: "Holds the temperature and asks for the iodine test; on No, rests the minutes and asks again.",
    required: ["temperature", "minutes"],
    optional: [],
  },
  Lautering: { label: "Lautering", summary: "Switches everything off and asks the brewer to lauter.", required: [], optional: [] },
  HeatUpForHopsCooking: {
    label: "Heat Up (hops cooking)",
    summary: "Heats at full power to 97 °C.",
    required: [],
    optional: [],
  },
  CookWater: {
    label: "Cook",
    summary: "Cooks at 100 °C for the minutes, with its own name and description.",
    required: ["name", "description", "minutes"],
    optional: [],
  },
};

export const FIELD_LABELS: Record<GoalField, string> = {
  temperature: "Temperature (°C)",
  minutes: "Minutes",
  name: "Name",
  description: "Description",
};

export function isGoalType(type: unknown): type is GoalType {
  return typeof type === "string" && (GOAL_TYPES as readonly string[]).includes(type);
}

/** The fields a goal type takes, in file order. */
export function goalFields(type: string): GoalField[] {
  if (!isGoalType(type)) {
    return [];
  }
  const info = GOAL_INFO[type];
  const order: GoalField[] = ["temperature", "minutes", "name", "description"];
  return order.filter((f) => info.required.includes(f) || info.optional.includes(f));
}

/** A new goal of the type, with the required numbers preset so it is valid where it can be. */
export function newGoal(type: GoalType): Goal {
  switch (type) {
    case "HeatUp":
      return { type, temperature: 62 };
    case "Rest":
    case "IodineTest":
      return { type, temperature: 62, minutes: 10 };
    case "CookWater":
      return { type, name: "", description: "", minutes: 60 };
    default:
      return { type };
  }
}

/** Changes a goal's type, keeping the values the new type also takes. */
export function changeGoalType(goal: Goal, type: GoalType): Goal {
  const fresh = newGoal(type);
  for (const field of goalFields(type)) {
    if (goal[field] !== undefined) {
      fresh[field] = goal[field];
    }
  }
  return fresh;
}

/** A new, empty recipe: the brewer fills in name and goals. */
export function emptyRecipe(): Recipe {
  return { version: FORMAT_VERSION, name: "", mashing_process: { goals: [] } };
}

export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Turns an uploaded file name into a recipe id: "Weizen.json" -> "Weizen". */
export function idFromFileName(fileName: string): string {
  return fileName.replace(/\.json$/i, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toGoal(value: unknown): Goal {
  return isObject(value) ? ({ ...value, type: String(value.type ?? "") } as Goal) : ({ type: "" } as Goal);
}

export interface ReadRecipe {
  /** The editable recipe; undefined when the file can't be edited here (newer format version). */
  recipe?: Recipe;
  /** What the editor changed to bring the file into the current format; saving or downloading writes it so. */
  converted?: string;
  /** Why the file can't be edited. */
  error?: string;
}

/**
 * Makes an editable recipe of parsed JSON, in the current format version. Keeps everything else the file had, so the
 * validator can point at what is wrong; only the shape the editor needs is enforced. Files in the old format (goals
 * at the top level, before brewberrypi-app Q-31) are converted; files of a newer format version are refused, so
 * nothing the editor doesn't know is lost.
 */
export function readRecipe(json: unknown): ReadRecipe {
  const source = isObject(json) ? json : {};
  const changes: string[] = [];
  const { $schema: _schema, version, goals: flatGoals, mashing_process: mashing, ...rest } = source;
  if (typeof version === "number" && Number.isInteger(version) && version > FORMAT_VERSION) {
    return {
      error:
        `This recipe file is in format version ${version}; this editor knows version ${FORMAT_VERSION}. ` +
        "It was written for a newer BrewberryPi app. Reload the editor to get the latest version.",
    };
  }
  if (version !== undefined && version !== FORMAT_VERSION) {
    changes.push(`its format version ${JSON.stringify(version)} is not valid; it is written as version ${FORMAT_VERSION}`);
  }
  let process: MashingProcess;
  if (isObject(mashing)) {
    process = { ...mashing, goals: Array.isArray(mashing.goals) ? mashing.goals.map(toGoal) : [] };
    if (flatGoals !== undefined) {
      rest.goals = flatGoals;
    }
  } else if (Array.isArray(flatGoals)) {
    process = { goals: flatGoals.map(toGoal) };
    changes.push('it was in the old format; its goals are moved into "mashing_process"');
  } else {
    process = { goals: [] };
    if (flatGoals !== undefined) {
      rest.goals = flatGoals;
    }
  }
  const recipe: Recipe = {
    version: FORMAT_VERSION,
    ...rest,
    name: typeof source.name === "string" ? source.name : "",
    mashing_process: process,
  };
  return { recipe, converted: changes.length > 0 ? `Converted: ${changes.join("; ")}.` : undefined };
}

/** readRecipe for recipes known to be in the current format (samples, tests). */
export function toRecipe(json: unknown): Recipe {
  return readRecipe(json).recipe ?? emptyRecipe();
}

const indentGoal = (goal: Goal) =>
  `{ ${Object.entries(goal)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ")} }`;

/**
 * The file content, formatted like the app's shipped recipes: "version" first (RCP-008), one line per goal. The
 * editor does not write "$schema" (optional, ignored by the app).
 */
export function serializeRecipe(recipe: Recipe): string {
  const { $schema: _schema, version, name, mashing_process: process, ...rest } = recipe;
  const { goals, ...processRest } = process;
  const lines: string[] = [];
  if (version !== undefined) {
    lines.push(`  "version": ${JSON.stringify(version)},`);
  }
  lines.push(`  "name": ${JSON.stringify(name)},`);
  const processLines: string[] = [];
  if (goals.length === 0) {
    processLines.push(`    "goals": []`);
  } else {
    processLines.push(`    "goals": [`);
    goals.forEach((goal, i) => processLines.push(`      ${indentGoal(goal)}${i < goals.length - 1 ? "," : ""}`));
    processLines.push(`    ]`);
  }
  for (const [key, value] of Object.entries(processRest)) {
    processLines[processLines.length - 1] += ",";
    processLines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  lines.push(`  "mashing_process": {`, ...processLines, `  }`);
  for (const [key, value] of Object.entries(rest)) {
    lines[lines.length - 1] += ",";
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  return `{\n${lines.join("\n")}\n}\n`;
}
