/** The selected recipe: file name, name, goals, problems and the actions. */

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { problemsOf, type Doc } from "../doc";
import { GOAL_INFO, GOAL_TYPES, goalsOf, newGoal, withGoals, type Goal, type GoalType, type Recipe } from "../model";
import { GOALS_PATH } from "../validate";
import { GoalEditor } from "./GoalEditor";
import { dropSlot, moveItem, targetIndex } from "./reorder";
import { BUTTON_STYLES, CARD_STYLE, HINT_STYLE, INPUT_STYLE, INVALID_INPUT, LABEL_STYLE, SELECT_STYLE, TITLE_STYLE } from "./styles";

const PATH_LABELS: Record<string, string> = {
  id: "File name",
  name: "Recipe name",
  version: "Format version",
  mashing_process: "Mashing process",
  [GOALS_PATH]: "Goals",
};

function describePath(path: string): string {
  const goal = /^mashing_process\.goals\[(\d+)\](?:\.(\w+))?$/.exec(path);
  if (goal) {
    return `Goal ${Number(goal[1]) + 1}`;
  }
  return PATH_LABELS[path] ?? (path || "Recipe");
}

export function ProblemList(props: { doc: Doc }) {
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
        {problems.map((p, i) => (
          <li key={i}>
            <span class="font-medium">{describePath(p.path)}:</span> {p.message}
            {p.path === "id" && " Rename it with the recipe's menu (⋯) in the list."}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecipeEditor(props: { doc: Doc; onChange: (recipe: Recipe) => void; actions: ComponentChildren; status?: ComponentChildren }) {
  const { doc } = props;
  const problems = problemsOf(doc);
  const [addType, setAddType] = useState<GoalType>("HeatUp");
  const setRecipe = (recipe: Recipe) => props.onChange(recipe);
  const setGoals = (goals: Goal[]) => setRecipe(withGoals(doc.recipe, goals));
  const goals = goalsOf(doc.recipe);
  const has = (path: string) => problems.some((p) => p.path === path);
  const list = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; slot: number }>();
  const [focusHandle, setFocusHandle] = useState<number>();

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
          setGoals(moveItem(goals, from, to));
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
        <div class="min-w-0">
          <h2 class={TITLE_STYLE}>{doc.recipe.name.trim() || "Untitled recipe"}</h2>
          <p class={`${HINT_STYLE} mt-0.5 truncate`} title="Rename it in the recipe's menu in the list">
            {doc.id}.json
          </p>
        </div>
        {props.status}
      </div>

      <div class="mt-4">
        <label class="block">
          <span class={LABEL_STYLE}>Recipe name</span>
          <input
            type="text"
            class={`${INPUT_STYLE} mt-1 ${has("name") ? INVALID_INPUT : ""}`}
            value={doc.recipe.name}
            placeholder="e.g. Hefeweizen 12.5 °P"
            onInput={(e) => setRecipe({ ...doc.recipe, name: e.currentTarget.value })}
          />
          <span class={`${HINT_STYLE} mt-1 block`}>Shown in the app's process list.</span>
        </label>
      </div>

      <h3 class="mt-6 text-sm font-semibold text-ink dark:text-ink-light">Mashing process: goals in brewing order</h3>
      {goals.length === 0 ? (
        <p class={`${HINT_STYLE} mt-2`}>No goals yet. Add them below; until then the BrewberryPi app lists this recipe but can't brew it.</p>
      ) : (
        <ol ref={list} class="mt-2 space-y-2">
          {goals.map((goal, i) => (
            <GoalEditor
              key={`${doc.key}-${i}`}
              goal={goal}
              index={i}
              count={goals.length}
              problems={problems}
              onChange={(g) => setGoals(goals.map((x, j) => (j === i ? g : x)))}
              onDragStart={(e) => startDrag(i, e)}
              onMoveKey={(delta) => {
                const to = i + delta;
                if (to >= 0 && to < goals.length) {
                  setGoals(moveItem(goals, i, to));
                  setFocusHandle(to);
                }
              }}
              dragging={drag?.from === i}
              dropLine={dropLine(i)}
              onRemove={() => setGoals(goals.filter((_, j) => j !== i))}
            />
          ))}
        </ol>
      )}
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <select class={`${SELECT_STYLE} min-w-0 flex-1 sm:flex-none`} aria-label="Type of the new goal" value={addType} onChange={(e) => setAddType(e.currentTarget.value as GoalType)}>
          {GOAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {GOAL_INFO[type].label} ({type})
            </option>
          ))}
        </select>
        <button type="button" class={BUTTON_STYLES.secondary} onClick={() => setGoals([...goals, newGoal(addType)])}>
          + Add goal
        </button>
      </div>

      <div class="mt-6 space-y-2">
        {doc.notice && (
          <p class="rounded-lg bg-stone-100 p-3 text-sm text-stone-700 dark:bg-white/5 dark:text-stone-300" role="note">
            {doc.notice} Download or save it to write the file in the current format.
          </p>
        )}
        <ProblemList doc={doc} />
      </div>
      <div class="mt-4 flex flex-wrap gap-2">{props.actions}</div>
    </section>
  );
}
