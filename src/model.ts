/** Recipe and goal types: the recipe file format of brewberrypi-app (data/recipe.schema.json, spec 04 and 07). */

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

export interface Recipe {
  name: string;
  goals: Goal[];
  [key: string]: unknown;
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
  return { name: "", goals: [] };
}

export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Turns an uploaded file name into a recipe id: "HIPA.json" -> "HIPA". */
export function idFromFileName(fileName: string): string {
  return fileName.replace(/\.json$/i, "");
}

/** The recipe without "$schema", which the editor does not keep (the app ignores it). */
export function withoutSchemaRef(recipe: Recipe): Recipe {
  const { $schema: _ignored, ...rest } = recipe;
  return rest as Recipe;
}

/**
 * Makes an editable recipe from parsed JSON. Keeps everything the file had, so the validator can point at what is
 * wrong; only the shape the editor needs (a name string, a goals array of objects) is enforced.
 */
export function toRecipe(json: unknown): Recipe {
  const source = typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  const recipe: Recipe = { ...source, name: typeof source.name === "string" ? source.name : "", goals: [] };
  if (Array.isArray(source.goals)) {
    recipe.goals = source.goals.map((g) =>
      typeof g === "object" && g !== null && !Array.isArray(g)
        ? ({ ...(g as Record<string, unknown>), type: String((g as Record<string, unknown>).type ?? "") } as Goal)
        : ({ type: "" } as Goal),
    );
  }
  return withoutSchemaRef(recipe);
}

/** The file content, formatted like the sample recipes: one line per goal. */
export function serializeRecipe(recipe: Recipe): string {
  const { name, goals, ...rest } = withoutSchemaRef(recipe);
  const lines = [`  "name": ${JSON.stringify(name)},`];
  for (const [key, value] of Object.entries(rest)) {
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  }
  if (goals.length === 0) {
    lines.push(`  "goals": []`);
  } else {
    lines.push(`  "goals": [`);
    goals.forEach((goal, i) => {
      const fields = Object.entries(goal)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
      lines.push(`    { ${fields.join(", ")} }${i < goals.length - 1 ? "," : ""}`);
    });
    lines.push(`  ]`);
  }
  return `{\n${lines.join("\n")}\n}\n`;
}
