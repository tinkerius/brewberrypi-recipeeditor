/** One goal of a recipe: its type and the fields that type takes (spec 04, 07 §7.2). */

import { FIELD_LABELS, GOAL_INFO, GOAL_TYPES, changeGoalType, goalFields, isGoalType, type Goal } from "../model";
import { GOALS_PATH, type Problem } from "../validate";
import { NumberField, TextField } from "./fields";
import { BUTTON_STYLES, HINT_STYLE, SELECT_STYLE } from "./styles";

export function GoalEditor(props: {
  goal: Goal;
  index: number;
  count: number;
  problems: Problem[];
  onChange: (goal: Goal) => void;
  /** The drag handle was pressed (drag and drop, EDT-012). */
  onDragStart: (event: PointerEvent) => void;
  /** The arrow keys on the focused handle (keyboard reordering). */
  onMoveKey: (delta: -1 | 1) => void;
  onRemove: () => void;
  dragging?: boolean;
  /** Show the drop line above (before) or below (after) this goal. */
  dropLine?: "before" | "after";
}) {
  const { goal, index } = props;
  const at = `${GOALS_PATH}[${index}]`;
  const problemsAt = (field: string) => props.problems.filter((p) => p.path === `${at}.${field}`);
  const known = isGoalType(goal.type);
  const fields = goalFields(goal.type);
  const unknownFields = Object.keys(goal).filter((k) => k !== "type" && !(fields as string[]).includes(k));
  const set = (field: string, value: unknown) => {
    const next: Goal = { ...goal };
    if (value === undefined) {
      delete next[field];
    } else {
      next[field] = value;
    }
    props.onChange(next);
  };
  const customTexts = goal.type === "Rest" && (goal.name !== undefined || goal.description !== undefined);

  return (
    <li
      class={
        "relative rounded-lg bg-white p-3 ring-1 sm:p-4 dark:bg-surface-dark " +
        (props.dragging ? "opacity-60 ring-2 ring-berry dark:ring-berry-light" : "ring-stone-200 dark:ring-white/10")
      }
    >
      {props.dropLine && (
        <span
          aria-hidden="true"
          data-drop-line
          class={`absolute right-0 left-0 h-1 rounded-full bg-berry dark:bg-berry-light ${props.dropLine === "before" ? "-top-1.5" : "-bottom-1.5"}`}
        />
      )}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-drag-handle
          aria-label={`Move goal ${index + 1}`}
          title="Drag to move the goal (or use the arrow keys)"
          disabled={props.count < 2}
          class={
            "-ml-1 flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded-md text-stone-400 " +
            "hover:enabled:bg-stone-100 hover:enabled:text-stone-600 active:cursor-grabbing disabled:cursor-default disabled:opacity-30 " +
            "focus-visible:outline-2 focus-visible:outline-berry dark:hover:enabled:bg-white/10 dark:hover:enabled:text-stone-200"
          }
          onPointerDown={(e) => {
            if (e.button === 0 && props.count > 1) {
              props.onDragStart(e);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              props.onMoveKey(e.key === "ArrowUp" ? -1 : 1);
            }
          }}
        >
          <svg viewBox="0 0 12 20" aria-hidden="true" class="h-4 w-3 fill-current">
            <circle cx="3" cy="4" r="1.5" />
            <circle cx="9" cy="4" r="1.5" />
            <circle cx="3" cy="10" r="1.5" />
            <circle cx="9" cy="10" r="1.5" />
            <circle cx="3" cy="16" r="1.5" />
            <circle cx="9" cy="16" r="1.5" />
          </svg>
        </button>
        <span class="w-6 text-sm font-semibold text-stone-500 tabular-nums dark:text-stone-400">{index + 1}.</span>
        <select
          class={`${SELECT_STYLE} min-w-0 flex-1 sm:flex-none`}
          aria-label={`Goal ${index + 1} type`}
          value={known ? goal.type : ""}
          onChange={(e) => props.onChange(changeGoalType(goal, e.currentTarget.value as (typeof GOAL_TYPES)[number]))}
        >
          {!known && <option value="">{goal.type ? `Unknown: ${goal.type}` : "Choose a type"}</option>}
          {GOAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {GOAL_INFO[type].label} ({type})
            </option>
          ))}
        </select>
        <div class="ml-auto flex gap-1">
          <button type="button" class={BUTTON_STYLES.small} title="Remove goal" aria-label="Remove goal" onClick={props.onRemove}>
            ✕
          </button>
        </div>
      </div>
      {known && <p class={`${HINT_STYLE} mt-2`}>{GOAL_INFO[goal.type as keyof typeof GOAL_INFO].summary}</p>}

      {fields.length > 0 && (
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          {fields.includes("temperature") && (
            <NumberField
              label={FIELD_LABELS.temperature}
              value={goal.temperature}
              invalid={problemsAt("temperature").length > 0}
              onChange={(v) => set("temperature", v)}
            />
          )}
          {fields.includes("minutes") && (
            <NumberField
              label={FIELD_LABELS.minutes}
              value={goal.minutes}
              integer
              invalid={problemsAt("minutes").length > 0}
              onChange={(v) => set("minutes", v)}
            />
          )}
          {goal.type === "Rest" && (
            <label class="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                class="size-4 accent-berry"
                checked={customTexts}
                onChange={(e) =>
                  props.onChange(
                    e.currentTarget.checked
                      ? { ...goal, name: goal.name ?? "", description: goal.description ?? "" }
                      : (({ name: _n, description: _d, ...rest }) => rest as Goal)(goal),
                  )
                }
              />
              Own name and description (otherwise the app shows "Rest at … degrees (C) for …min.")
            </label>
          )}
          {(goal.type === "CookWater" || customTexts) && (
            <>
              <TextField label={FIELD_LABELS.name} value={goal.name} invalid={problemsAt("name").length > 0} onChange={(v) => set("name", v)} />
              <TextField
                label={FIELD_LABELS.description}
                value={goal.description}
                multiline
                invalid={problemsAt("description").length > 0}
                onChange={(v) => set("description", v)}
              />
            </>
          )}
        </div>
      )}

      {unknownFields.length > 0 && (
        <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <span>
            Fields this goal type does not take: {unknownFields.map((f) => `"${f}"`).join(", ")}
          </span>
          <button
            type="button"
            class={BUTTON_STYLES.small}
            onClick={() => {
              const next: Goal = { type: goal.type };
              for (const f of fields) {
                if (goal[f] !== undefined) {
                  next[f] = goal[f];
                }
              }
              props.onChange(next);
            }}
          >
            Remove them
          </button>
        </div>
      )}
    </li>
  );
}
