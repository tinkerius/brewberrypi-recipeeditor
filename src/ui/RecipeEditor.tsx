/** The selected recipe: file name, name, its tabs (malt, hops, water, mashing plan, goals), problems and actions. */

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { problemsOf, type Doc } from "../doc";
import { INGREDIENT_LABELS, MASH_RESTS, goalsOf, isMashRestId, newGoal, withGoals, type Goal, type Recipe } from "../model";
import { BATCH_PATH, GOALS_PATH, INGREDIENTS_PATH, MASHING_PATH, WATER_PATH } from "../validate";
import { ADD_ROW_LINE, AddRowButton } from "./AddRow";
import { GoalEditor } from "./GoalEditor";
import { GoalTypeDialog } from "./GoalTypeDialog";
import { IngredientsTab } from "./IngredientsTab";
import { MashingTab } from "./MashingTab";
import { WaterTab } from "./WaterTab";
import { RecipeTitle } from "./RecipeTitle";
import { Tabs } from "./Tabs";
import { moveItem } from "./reorder";
import { useReorder } from "./useReorder";
import { BUTTON_STYLES, CARD_STYLE, HINT_STYLE, LINK_STYLE } from "./styles";

const PATH_LABELS: Record<string, string> = {
  id: "File name",
  name: "Recipe name",
  version: "Format version",
  mashing_process: "Mashing process",
  [GOALS_PATH]: "Goals",
  [MASHING_PATH]: "Mashing",
  [INGREDIENTS_PATH]: "Ingredients",
  [BATCH_PATH]: "Batch",
  [`${BATCH_PATH}.liters`]: "Knockout volume",
  [`${BATCH_PATH}.plato`]: "Original gravity",
  [`${BATCH_PATH}.final_plato`]: "Final gravity",
  [WATER_PATH]: "Water",
  [`${WATER_PATH}.mash`]: "Mash water",
  [`${WATER_PATH}.sparge`]: "Sparge water",
  [`${WATER_PATH}.top_up`]: "Top-up water",
};

/** The goal a problem is about, if any (its index). */
function goalOf(path: string): number | undefined {
  const goal = /^mashing_process\.goals\[(\d+)\](?:\.(\w+))?$/.exec(path);
  return goal ? Number(goal[1]) : undefined;
}

/**
 * The tab a problem of the ingredients, the batch or the water is on (EDT-045, EDT-051): the hops and the gravity on
 * Water (where they are entered): the water, the knockout volume and the gravities; else Malt or Hops.
 */
function ingredientsTab(path: string): "malts" | "hops" | "water" | undefined {
  const about = (prefix: string) => path === prefix || path.startsWith(`${prefix}.`);
  if (path.startsWith(`${INGREDIENTS_PATH}.hops`) || path.startsWith(`${INGREDIENTS_PATH}.others`)) {
    return "hops";
  }
  if (about(WATER_PATH) || about(BATCH_PATH)) {
    return "water";
  }
  return about(INGREDIENTS_PATH) || about(BATCH_PATH) ? "malts" : undefined;
}

/** Whether a problem is about the mashing plan (the Mashing tab). */
function isMashing(path: string): boolean {
  return path === MASHING_PATH || path.startsWith(`${MASHING_PATH}.`);
}

function describePath(path: string): string {
  const goal = goalOf(path);
  if (goal !== undefined) {
    return `Goal ${goal + 1}`;
  }
  const ingredient = /^ingredients\.(malts|hops|others)(?:\[(\d+)\])?/.exec(path);
  if (ingredient) {
    const { title, one } = INGREDIENT_LABELS[ingredient[1] as "malts" | "hops" | "others"];
    return ingredient[2] === undefined ? title : `${one} ${Number(ingredient[2]) + 1}`;
  }
  const rest = /^mashing\.([^.]+)/.exec(path)?.[1];
  if (rest !== undefined) {
    return `Mashing, ${isMashRestId(rest) ? MASH_RESTS[rest].short : rest}`;
  }
  return PATH_LABELS[path] ?? (path || "Recipe");
}

/**
 * The problems (EDT-020); a goal's problem opens that goal when its "Goal n" is clicked, a problem of the mashing
 * plan opens the Mashing tab (EDT-035), one of the malts, hops, batch or water its tab (EDT-045, EDT-051).
 */
export function ProblemList(props: {
  doc: Doc;
  onGoal?: (index: number) => void;
  onMashing?: () => void;
  onIngredients?: (tab: "malts" | "hops" | "water") => void;
}) {
  const problems = problemsOf(props.doc);
  if (props.doc.loadError) {
    return (
      <p class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">
        {props.doc.loadError}
      </p>
    );
  }
  if (problems.length === 0) {
    return (
      <p class="rounded-lg bg-leaf/10 p-3 text-sm text-leaf dark:bg-leaf-light/10 dark:text-leaf-light">
        {goalsOf(props.doc.recipe).length === 0
          ? "✓ Valid recipe file. It has no goals yet, so BrewberryPi lists it but can't brew it."
          : "✓ Complete: BrewberryPi can load this recipe."}
      </p>
    );
  }
  return (
    <div class="rounded-lg bg-brass/10 p-3 text-sm dark:bg-brass-light/10" role="status">
      <p class="font-medium text-ink dark:text-ink-light">Incomplete — fix these before saving or downloading:</p>
      <ul class="mt-1 list-disc pl-5 text-stone-700 dark:text-stone-300">
        {problems.map((p, i) => {
          const goal = goalOf(p.path);
          return (
            <li key={i}>
              {goal !== undefined && props.onGoal ? (
                <button type="button" class={LINK_STYLE} onClick={() => props.onGoal!(goal)}>
                  {describePath(p.path)}
                </button>
              ) : isMashing(p.path) && props.onMashing ? (
                <button type="button" class={LINK_STYLE} onClick={props.onMashing}>
                  {describePath(p.path)}
                </button>
              ) : ingredientsTab(p.path) && props.onIngredients ? (
                <button type="button" class={LINK_STYLE} onClick={() => props.onIngredients!(ingredientsTab(p.path)!)}>
                  {describePath(p.path)}
                </button>
              ) : (
                <span class="font-medium">{describePath(p.path)}</span>
              )}
              : {p.message}
              {p.path === "id" && " Rename it with the recipe's menu (⋯) in the list."}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The recipe's tabs (GUI-032, QE-28, QE-32, QE-34, QE-35); more come later. */
const RECIPE_TABS = [
  { id: "malts", label: "Malt" },
  { id: "mashing", label: "Mashing" },
  { id: "hops", label: "Boiling" },
  { id: "water", label: "Water" },
  { id: "mash", label: "Mash Process" },
] as const;
type RecipeTab = (typeof RECIPE_TABS)[number]["id"];

export function RecipeEditor(props: { doc: Doc; onChange: (recipe: Recipe) => void; actions?: ComponentChildren; status?: ComponentChildren }) {
  const { doc } = props;
  const problems = problemsOf(doc);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<RecipeTab>("malts");
  const setRecipe = (recipe: Recipe) => props.onChange(recipe);
  const setGoals = (goals: Goal[]) => setRecipe(withGoals(doc.recipe, goals));
  const goals = goalsOf(doc.recipe);
  const has = (path: string) => problems.some((p) => p.path === path);
  // The open goal (EDT-011, one at a time), for this recipe only.
  const [opened, setOpened] = useState<{ key: string; index: number; focus?: boolean }>();
  const open = opened?.key === doc.key ? opened.index : undefined;
  const setOpen = (index: number | undefined, focus = false) =>
    setOpened(index === undefined ? undefined : { key: doc.key, index, focus });
  /** Moves goals and keeps the open one open where it went. */
  const moveGoal = (from: number, to: number) => {
    setGoals(moveItem(goals, from, to));
    if (open !== undefined) {
      setOpen(moveItem(goals.map((_, j) => j), from, to).indexOf(open));
    }
  };

  // Opened from the problem list: its first field gets the focus (and so scrolls into view).
  useEffect(() => {
    if (opened?.focus && open !== undefined) {
      const item = list.current?.children[open];
      (item?.querySelector<HTMLElement>("input, textarea") ?? item?.querySelector<HTMLElement>("[data-goal-line]"))?.focus();
      setOpened({ ...opened, focus: false });
    }
  }, [opened]);

  const reorder = useReorder<HTMLOListElement>(goals.length, moveGoal);
  const list = reorder.container;

  return (
    <section class={CARD_STYLE} aria-label="Recipe">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <RecipeTitle
            docKey={doc.key}
            name={doc.recipe.name}
            invalid={has("name")}
            onChange={(name) => setRecipe({ ...doc.recipe, name })}
          />
        </div>
        {props.status}
      </div>


      <Tabs label="Recipe sections" tabs={RECIPE_TABS} selected={tab} onSelect={setTab}>
        {tab === "water" ? (
          <WaterTab recipe={doc.recipe} problems={problems} onChange={setRecipe} />
        ) : tab === "malts" || tab === "hops" ? (
          <IngredientsTab key={tab} kind={tab} recipe={doc.recipe} problems={problems} onChange={setRecipe} onWater={() => setTab("water")} />
        ) : tab === "mashing" ? (
          <MashingTab recipe={doc.recipe} problems={problems} onChange={setRecipe} />
        ) : (
          <>
            <p class={HINT_STYLE}>The goals in brewing order.</p>
            {goals.length === 0 && (
              <p class={`${HINT_STYLE} mt-2`}>No goals yet. Add them below; until then the BrewberryPi app lists this recipe but can't brew it.</p>
            )}
            <div class="mt-2 rounded-lg ring-1 ring-line dark:ring-white/10">
              {goals.length > 0 && (
                <ol ref={list} class="divide-y divide-line dark:divide-white/10">
                  {goals.map((goal, i) => (
                    <GoalEditor
                      key={`${doc.key}-${i}`}
                      goal={goal}
                      index={i}
                      count={goals.length}
                      problems={problems}
                      open={open === i}
                      onToggle={() => setOpen(open === i ? undefined : i)}
                      onChange={(g) => setGoals(goals.map((x, j) => (j === i ? g : x)))}
                      onDragStart={(e) => reorder.startDrag(i, e)}
                      onMoveKey={(delta) => reorder.moveKey(i, delta)}
                      dragging={reorder.dragging(i)}
                      dropLine={reorder.dropLine(i)}
                      onRemove={() => {
                        setGoals(goals.filter((_, j) => j !== i));
                        if (open !== undefined && open >= i) {
                          setOpen(open === i ? undefined : open - 1);
                        }
                      }}
                    />
                  ))}
                </ol>
              )}
              <div class={goals.length > 0 ? ADD_ROW_LINE : ""}>
                <AddRowButton label="Add goal" class={goals.length > 0 ? "rounded-b-lg" : "rounded-lg"} onClick={() => setAdding(true)} />
              </div>
            </div>
            {adding && (
              <GoalTypeDialog
                title="Add a goal"
                onCancel={() => setAdding(false)}
                onChoose={(type) => {
                  setAdding(false);
                  setGoals([...goals, newGoal(type)]);
                  setOpen(goals.length);
                }}
              />
            )}
          </>
        )}
      </Tabs>

      <div class="mt-6 space-y-2">
        {doc.notice && (
          <p class="rounded-lg bg-stone-100 p-3 text-sm text-stone-700 dark:bg-white/5 dark:text-stone-300" role="note">
            {doc.notice} Download or save it to write the file in the current format.
          </p>
        )}
        <ProblemList
          doc={doc}
          onGoal={(index) => {
            setTab("mash");
            setOpen(index, true);
          }}
          onMashing={() => setTab("mashing")}
          onIngredients={(t) => setTab(t)}
        />
      </div>
      {props.actions && <div class="mt-4 flex flex-wrap gap-2">{props.actions}</div>}
    </section>
  );
}
