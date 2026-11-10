/** The selected recipe: file name, name, its tabs (goals, mashing plan), problems and the actions. */

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { problemsOf, type Doc } from "../doc";
import { MASH_RESTS, goalsOf, isMashRestId, newGoal, withGoals, type Goal, type Recipe } from "../model";
import { GOALS_PATH, MASHING_PATH } from "../validate";
import { GoalEditor } from "./GoalEditor";
import { GoalTypeDialog } from "./GoalTypeDialog";
import { MashingTab } from "./MashingTab";
import { RecipeTitle } from "./RecipeTitle";
import { Tabs } from "./Tabs";
import { dropSlot, moveItem, targetIndex } from "./reorder";
import { BUTTON_STYLES, CARD_STYLE, HINT_STYLE, LINK_STYLE } from "./styles";

const PATH_LABELS: Record<string, string> = {
  id: "File name",
  name: "Recipe name",
  version: "Format version",
  mashing_process: "Mashing process",
  [GOALS_PATH]: "Goals",
  [MASHING_PATH]: "Mashing",
};

/** The goal a problem is about, if any (its index). */
function goalOf(path: string): number | undefined {
  const goal = /^mashing_process\.goals\[(\d+)\](?:\.(\w+))?$/.exec(path);
  return goal ? Number(goal[1]) : undefined;
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
  const rest = /^mashing\.([^.]+)/.exec(path)?.[1];
  if (rest !== undefined) {
    return `Mashing, ${isMashRestId(rest) ? MASH_RESTS[rest].short : rest}`;
  }
  return PATH_LABELS[path] ?? (path || "Recipe");
}

/**
 * The problems (EDT-020); a goal's problem opens that goal when its "Goal n" is clicked, a problem of the mashing
 * plan opens the Mashing tab (EDT-035).
 */
export function ProblemList(props: { doc: Doc; onGoal?: (index: number) => void; onMashing?: () => void }) {
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

/** The recipe's tabs (GUI-032, QE-28, QE-32); more come later. */
const RECIPE_TABS = [
  { id: "mashing", label: "Mashing" },
  { id: "mash", label: "Mash Process" },
] as const;
type RecipeTab = (typeof RECIPE_TABS)[number]["id"];

export function RecipeEditor(props: { doc: Doc; onChange: (recipe: Recipe) => void; actions?: ComponentChildren; status?: ComponentChildren }) {
  const { doc } = props;
  const problems = problemsOf(doc);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<RecipeTab>("mash");
  const setRecipe = (recipe: Recipe) => props.onChange(recipe);
  const setGoals = (goals: Goal[]) => setRecipe(withGoals(doc.recipe, goals));
  const goals = goalsOf(doc.recipe);
  const has = (path: string) => problems.some((p) => p.path === path);
  const list = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; slot: number }>();
  const [focusHandle, setFocusHandle] = useState<number>();
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

  // Keyboard reordering: the moved goal's handle keeps the focus.
  useEffect(() => {
    if (focusHandle !== undefined) {
      list.current?.children[focusHandle]?.querySelector<HTMLButtonElement>("[data-drag-handle]")?.focus();
      setFocusHandle(undefined);
    }
  }, [focusHandle]);

  /** Drag and drop with the handle (EDT-012): pointer events, so mouse, pen and touch all work. */
  const startDrag = (from: number, event: PointerEvent) => {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture?.(event.pointerId);
    const midpoints = () =>
      [...(list.current?.children ?? [])].map((item) => {
        const r = item.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    setDrag({ from, slot: from });
    const move = (e: PointerEvent) => {
      if (e.clientY < 60) {
        window.scrollBy(0, -16);
      } else if (e.clientY > window.innerHeight - 60) {
        window.scrollBy(0, 16);
      }
      setDrag({ from, slot: dropSlot(e.clientY, midpoints()) });
    };
    const finish = (e: PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      setDrag(undefined);
      if (e.type === "pointerup") {
        const to = targetIndex(from, dropSlot(e.clientY, midpoints()));
        if (to !== from) {
          moveGoal(from, to);
        }
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  };

  /** Where the drop line goes: none while the goal would stay where it is. */
  const dropLine = (i: number): "before" | "after" | undefined => {
    if (!drag || targetIndex(drag.from, drag.slot) === drag.from) {
      return undefined;
    }
    if (drag.slot === i) {
      return "before";
    }
    return drag.slot === goals.length && i === goals.length - 1 ? "after" : undefined;
  };

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
          <p class={`${HINT_STYLE} mt-0.5 truncate`} title="Rename the file in the recipe's menu in the list">
            {doc.id}.json
          </p>
        </div>
        {props.status}
      </div>


      <Tabs label="Recipe sections" tabs={RECIPE_TABS} selected={tab} onSelect={setTab}>
        {tab === "mashing" ? (
          <MashingTab recipe={doc.recipe} problems={problems} onChange={setRecipe} />
        ) : (
          <>
            <p class={HINT_STYLE}>The goals in brewing order.</p>
            {goals.length === 0 ? (
              <p class={`${HINT_STYLE} mt-2`}>No goals yet. Add them below; until then the BrewberryPi app lists this recipe but can't brew it.</p>
            ) : (
              <ol
                ref={list}
                class="mt-2 divide-y divide-line rounded-lg ring-1 ring-line dark:divide-white/10 dark:ring-white/10"
              >
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
                    onDragStart={(e) => startDrag(i, e)}
                    onMoveKey={(delta) => {
                      const to = i + delta;
                      if (to >= 0 && to < goals.length) {
                        moveGoal(i, to);
                        setFocusHandle(to);
                      }
                    }}
                    dragging={drag?.from === i}
                    dropLine={dropLine(i)}
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
            <div class="mt-3">
              <button type="button" class={BUTTON_STYLES.secondary} onClick={() => setAdding(true)}>
                + Add goal
              </button>
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
        />
      </div>
      {props.actions && <div class="mt-4 flex flex-wrap gap-2">{props.actions}</div>}
    </section>
  );
}
