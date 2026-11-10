/**
 * Recipe and goal types: the recipe file format of brewberrypi-app (data/recipe.schema.json, spec 04 and 07 §7.2):
 * { "version": 3, "name": …, "mashing_process": { "goals": […] }, "mashing": { … } }, one recipe per file, the file
 * name is the id. The goals may be empty (app Q-34): the app then lists the recipe but can't load it. "mashing" is
 * the optional mashing plan (app Q-37, RCP-012): the rests the brewer plans, keyed by rest id; the app doesn't use it.
 */

/** The recipe file format version this editor reads and writes (RCP-008: the app's latest version). */
export const FORMAT_VERSION = 3;

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
  /** The mashing plan (app RCP-012); absent while no rest is planned. */
  mashing?: unknown;
  [key: string]: unknown;
}

/** The rests of a mashing plan, in the order the editor shows and writes them (app RCP-012, QE-32). */
export const MASH_REST_IDS = [
  "PreMash",
  "AcidRest",
  "BetaGlucanRest",
  "FerulicAcidRest",
  "ProteinRest",
  "MaltoseRest",
  "CombinedRest",
  "SaccharificationRest",
  "MashOut",
] as const;

export type MashRestId = (typeof MASH_REST_IDS)[number];

/** A planned rest as it is edited: temperature and minutes, plus whatever an uploaded file contained. */
export type MashRest = { temperature?: unknown; minutes?: unknown } & Record<string, unknown>;

export interface MashRestInfo {
  /** The full name, as in the product owner's table (EDT-031). */
  label: string;
  /** A short name, for problems ("Mashing, Maltose rest"). */
  short: string;
  /** The typical temperature range, as text. */
  range: string;
  /** Outside this range (°C, inclusive) the editor warns (EDT-033). */
  min: number;
  max: number;
  /** The typical duration, as text. */
  duration: string;
  /** Preset when the rest is ticked (EDT-032). */
  temperature: number;
  minutes: number;
  /** What the rest does: enzymes, effect, when it is useful. */
  about: [string, string][];
}

export const MASH_RESTS: Record<MashRestId, MashRestInfo> = {
  PreMash: {
    label: "Pre-mash / Dough-in rest (soaking)",
    short: "Pre-mash",
    range: "Room temp. to 40 °C, typ. ~35 °C",
    min: 15,
    max: 40,
    duration: "15–30 min (cold: up to several hours)",
    temperature: 35,
    minutes: 20,
    about: [
      ["Enzymes", "no targeted enzyme activity; amylases and proteases dissolve from the malt into the mash. Phytase and β-glucanase are slightly active at ~35–40 °C."],
      ["Effect", "hydrates the grist, softens the endosperm, prevents dough balls; enzymes are already in solution when the actual rests begin."],
      ["When useful", "coarse crush (e.g. lauter tun systems), poorly modified malts, before decoction, or to slightly increase efficiency. Cold pre-mashing also extracts fewer tannins and husk flavors."],
    ],
  },
  AcidRest: {
    label: "Acid rest / Phytase rest",
    short: "Acid rest",
    range: "30–35 °C (up to 52 °C), typ. ~35 °C",
    min: 30,
    max: 52,
    duration: "30–120 min",
    temperature: 35,
    minutes: 30,
    about: [
      ["Enzyme", "phytase."],
      ["Effect", "releases phosphates and lowers mash pH."],
      ["When useful", "practically never today (historically for low-acid malt); pH adjustment is easier with lactic acid or acidulated malt."],
    ],
  },
  BetaGlucanRest: {
    label: "Beta-glucan rest (gum rest)",
    short: "Beta-glucan rest",
    range: "35–45 °C, typ. ~40 °C",
    min: 35,
    max: 45,
    duration: "15–20 min",
    temperature: 40,
    minutes: 15,
    about: [
      ["Enzyme", "β-glucanase."],
      ["Effect", "breaks down beta-glucans (gums), lowers viscosity, improves lautering and filterability."],
      ["When useful", "high share of rye, oats, unmalted adjuncts, or poorly modified malts. Rapidly denatured above ~50 °C."],
    ],
  },
  FerulicAcidRest: {
    label: "Ferulic acid rest",
    short: "Ferulic acid rest",
    range: "43–45 °C, typ. ~45 °C",
    min: 43,
    max: 45,
    duration: "15–20 min",
    temperature: 45,
    minutes: 15,
    about: [
      ["Enzyme", "feruloyl esterase."],
      ["Effect", "releases ferulic acid, which phenolic (POF+) yeast converts to 4-vinyl guaiacol (clove aroma)."],
      ["When useful", "wheat beer and other styles with POF+ yeast when more clove character is desired."],
    ],
  },
  ProteinRest: {
    label: "Protein rest (protease rest)",
    short: "Protein rest",
    range: "45–55 °C, typ. ~52 °C",
    min: 45,
    max: 55,
    duration: "10–20 min",
    temperature: 52,
    minutes: 10,
    about: [
      ["Enzymes", "peptidases (~45–50 °C), proteinases (~50–55 °C)."],
      ["Effect", "lower range produces free amino nitrogen (FAN) as yeast nutrient; upper range breaks down large proteins, reducing haze."],
      ["When useful", "wheat, unmalted adjuncts, poorly modified malts. With modern well-modified malts keep it short or skip it, otherwise foam and body suffer."],
    ],
  },
  MaltoseRest: {
    label: "Maltose rest (beta-amylase rest)",
    short: "Maltose rest",
    range: "60–65 °C, typ. ~63 °C",
    min: 60,
    max: 65,
    duration: "30–60 min",
    temperature: 63,
    minutes: 45,
    about: [
      ["Enzyme", "β-amylase."],
      ["Effect", "cleaves maltose from starch chains, producing highly fermentable wort, high attenuation, lean and dry beer."],
      ["When useful", "almost always; extend for dry beers (Pils, Saison, Tripel). Heat-sensitive; prefers pH ~5.4 and a thick mash."],
    ],
  },
  CombinedRest: {
    label: "Combined rest (single infusion)",
    short: "Combined rest",
    range: "65–68 °C, typ. ~67 °C",
    min: 65,
    max: 68,
    duration: "60 min",
    temperature: 67,
    minutes: 60,
    about: [
      ["Enzymes", "β- and α-amylase simultaneously."],
      ["Effect", "compromise between attenuation and body; lower temperature gives a drier beer, higher a fuller one."],
      ["When useful", "simple brewing (infusion, BIAB) with well-modified malts."],
    ],
  },
  SaccharificationRest: {
    label: "Saccharification rest (dextrinization / alpha-amylase rest)",
    short: "Saccharification rest",
    range: "70–75 °C, typ. ~72 °C",
    min: 70,
    max: 75,
    duration: "20–40 min, until iodine-negative",
    temperature: 72,
    minutes: 30,
    about: [
      ["Enzyme", "α-amylase."],
      ["Effect", "breaks down starch into (unfermentable) dextrins, giving body, mouthfeel, and foam stability."],
      ["When useful", "almost always; extend for full-bodied beers (Bock, Märzen, Stout). Check for complete starch conversion with an iodine test before mash-out."],
    ],
  },
  MashOut: {
    label: "Mash-out",
    short: "Mash-out",
    range: "76–78 °C, typ. ~78 °C",
    min: 76,
    max: 78,
    duration: "Heat up + 5–10 min",
    temperature: 78,
    minutes: 10,
    about: [
      ["Enzymes", "none (inactivation)."],
      ["Effect", "fixes the sugar profile, lowers viscosity for better lautering."],
      ["When useful", "always. Do not exceed 78 °C, otherwise α-amylase is also destroyed and starch dissolved during lautering stays unconverted (starch haze)."],
    ],
  },
};

export function isMashRestId(id: unknown): id is MashRestId {
  return typeof id === "string" && (MASH_REST_IDS as readonly string[]).includes(id);
}

/** The mashing plan as an object (an uploaded file's non-object plan reads as empty here; the validator reports it). */
export function mashingOf(recipe: Recipe): Record<string, unknown> {
  return isObject(recipe.mashing) ? recipe.mashing : {};
}

/** The rest ids of a plan first in catalogue order, then whatever else it holds. */
function inPlanOrder(plan: Record<string, unknown>): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  for (const id of MASH_REST_IDS) {
    if (id in plan) {
      ordered[id] = plan[id];
    }
  }
  return { ...ordered, ...plan };
}

/**
 * Plans a rest (or, with undefined, drops it) (EDT-032). Without any rest left, the recipe has no "mashing" (EDT-034).
 */
export function withMashRest(recipe: Recipe, id: MashRestId, rest: MashRest | undefined): Recipe {
  const plan = { ...mashingOf(recipe) };
  if (rest === undefined) {
    delete plan[id];
  } else {
    plan[id] = rest;
  }
  const { mashing: _old, ...others } = recipe;
  return Object.keys(plan).length === 0 ? others : { ...others, mashing: inPlanOrder(plan) };
}

/** A new planned rest, with the preset temperature and minutes (EDT-032). */
export function newMashRest(id: MashRestId): MashRest {
  return { temperature: MASH_RESTS[id].temperature, minutes: MASH_RESTS[id].minutes };
}

/** Whether a rest's temperature is outside its typical range (EDT-033); only for numbers. */
export function outsideTypicalRange(id: MashRestId, temperature: unknown): boolean {
  return typeof temperature === "number" && (temperature < MASH_RESTS[id].min || temperature > MASH_RESTS[id].max);
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
  temperature: "Temperature",
  minutes: "Duration",
  name: "Name",
  description: "Description",
};

/** One part of a goal's line (EDT-011): the type, a joining word, a value, a missing value, or the goal's name. */
export interface LinePart {
  kind: "type" | "word" | "value" | "missing" | "name";
  text: string;
}

/**
 * A goal as one short sentence (QE-26): "Heat Up to 62 °C", "Rest at 65 °C for 30 min — Maltoserast". Display names
 * only (QE-24); a missing value reads "?", a value that is not a number is shown as typed (both "missing").
 */
export function goalLine(goal: Goal): LinePart[] {
  if (!isGoalType(goal.type)) {
    const text = typeof goal.type === "string" && goal.type ? `Unknown: ${goal.type}` : "Choose a type";
    return [{ kind: "missing", text }];
  }
  const fields = goalFields(goal.type);
  const parts: LinePart[] = [{ kind: "type", text: GOAL_INFO[goal.type].label }];
  const value = (v: unknown, unit: string): LinePart =>
    typeof v === "number" ? { kind: "value", text: `${v} ${unit}` } : { kind: "missing", text: `${typeof v === "string" && v ? v : "?"} ${unit}` };
  if (fields.includes("temperature")) {
    parts.push({ kind: "word", text: goal.type === "HeatUp" ? "to" : "at" }, value(goal.temperature, "°C"));
  }
  if (fields.includes("minutes")) {
    parts.push({ kind: "word", text: "for" }, value(goal.minutes, "min"));
  }
  if (typeof goal.name === "string" && goal.name.trim()) {
    parts.push({ kind: "word", text: "—" }, { kind: "name", text: goal.name });
  }
  return parts;
}

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
  // Versions 1 (or none) and 2 differ from version 3 only in what they don't allow yet (empty goals, the mashing
  // plan; app migrators 1 → 2 → 3): written as version 3 as they are.
  if (version !== undefined && version !== 1 && version !== 2 && version !== FORMAT_VERSION) {
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
 * The file content, formatted like the app's shipped recipes: "version" first (RCP-008), one line per goal, then the
 * mashing plan, one line per rest in catalogue order (FMT-006). The editor does not write "$schema" (optional,
 * ignored by the app).
 */
export function serializeRecipe(recipe: Recipe): string {
  const { $schema: _schema, version, name, mashing_process: process, mashing, ...rest } = recipe;
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
  if (isObject(mashing)) {
    const entries = Object.entries(inPlanOrder(mashing));
    if (entries.length === 0) {
      lines[lines.length - 1] += ",";
      lines.push(`  "mashing": {}`);
    } else {
      lines[lines.length - 1] += ",";
      lines.push(`  "mashing": {`);
      entries.forEach(([id, value], i) => {
        const text = isObject(value) ? indentGoal(value as Goal) : JSON.stringify(value);
        lines.push(`    ${JSON.stringify(id)}: ${text}${i < entries.length - 1 ? "," : ""}`);
      });
      lines.push(`  }`);
    }
  } else if (mashing !== undefined) {
    lines[lines.length - 1] += ",";
    lines.push(`  "mashing": ${JSON.stringify(mashing)}`);
  }
  for (const [key, value] of Object.entries(rest)) {
    lines[lines.length - 1] += ",";
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  }
  return `{\n${lines.join("\n")}\n}\n`;
}
