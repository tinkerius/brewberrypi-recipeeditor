/**
 * One goal of a recipe (spec 04, 07 §7.2) as one line (EDT-011, QE-26): its type and values as a short sentence.
 * Clicking the line opens the goal: the explanation of its type, the pencil for the type and its fields.
 */

import { useState } from "preact/hooks";
import { FIELD_LABELS, GOAL_INFO, changeGoalType, goalFields, goalLine, isGoalType, type Goal, type GoalType } from "../model";
import { GOALS_PATH, type Problem } from "../validate";
import { NumberField, TextField } from "./fields";
import { GoalTypeDialog } from "./GoalTypeDialog";
import { BUTTON_STYLES, HINT_STYLE } from "./styles";

const PART_STYLES = {
  type: "font-semibold text-ink dark:text-ink-light",
  word: "text-stone-500 dark:text-stone-400",
  value: "text-ink dark:text-ink-light",
  missing: "font-semibold text-red-600 dark:text-red-400",
  name: "italic text-stone-700 dark:text-stone-300",
} as const;

export function GoalEditor(props: {
  goal: Goal;
  index: number;
  count: number;
  problems: Problem[];
  /** Whether the goal's fields are shown (one goal at a time). */
  open: boolean;
  onToggle: () => void;
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
  const { goal, index, open } = props;
  const [choosing, setChoosing] = useState(false);
  const at = `${GOALS_PATH}[${index}]`;
  const problemsAt = (field: string) => props.problems.filter((p) => p.path === `${at}.${field}`);
  const incomplete = props.problems.some((p) => p.path === at || p.path.startsWith(`${at}.`));
  const known = isGoalType(goal.type);
  const fields = goalFields(goal.type);
  const unknownFields = Object.keys(goal).filter((k) => k !== "type" && !(fields as string[]).includes(k));
  const line = goalLine(goal);
  const panelId = `goal-${index}-fields`;
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
      data-goal-type={known ? goal.type : ""}
      class={
        "relative first:rounded-t-lg last:rounded-b-lg " +
        (props.dragging ? "bg-berry/10 opacity-60 dark:bg-berry-light/10" : open ? "bg-berry/5 dark:bg-berry-light/5" : "")
      }
    >
      {props.dropLine && (
        <span
          aria-hidden="true"
          data-drop-line
          class={`absolute right-0 left-0 z-10 h-1 rounded-full bg-berry dark:bg-berry-light ${props.dropLine === "before" ? "-top-0.5" : "-bottom-0.5"}`}
        />
      )}
      <div class="flex items-center gap-1 px-1.5 py-1 sm:gap-2">
        <button
          type="button"
          data-drag-handle
          aria-label={`Move goal ${index + 1}`}
          title="Drag to move the goal (or use the arrow keys)"
          disabled={props.count < 2}
          class={
            "flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-stone-400 " +
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
        <span class="w-6 shrink-0 text-sm text-stone-500 tabular-nums dark:text-stone-400">{index + 1}.</span>
        <button
          type="button"
          data-goal-line
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          title={known ? GOAL_INFO[goal.type as GoalType].summary : undefined}
          class={
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm " +
            "hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-berry dark:hover:bg-white/5 dark:focus-visible:outline-berry-light"
          }
          onClick={props.onToggle}
        >
          <span class="min-w-0 truncate">
            {line.map((part, i) => (
              <span key={i} class={PART_STYLES[part.kind]}>
                {i > 0 && " "}
                {part.text}
              </span>
            ))}
          </span>
          {incomplete && (
            <span
              data-incomplete
              title="Incomplete: open the goal to fix it"
              class="flex size-4 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white dark:bg-red-400 dark:text-paper-dark"
            >
              !<span class="sr-only"> (incomplete)</span>
            </span>
          )}
        </button>
        {open && (
          <button
            type="button"
            aria-label={`Change the type of goal ${index + 1}: ${known ? GOAL_INFO[goal.type as GoalType].label : "unknown"}`}
            title="Change the goal type"
            class="group flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-berry dark:text-stone-400 dark:hover:bg-white/5 dark:focus-visible:outline-berry-light"
            onClick={() => setChoosing(true)}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              class="size-4 fill-none stroke-current stroke-[1.6] group-hover:text-berry dark:group-hover:text-berry-light"
            >
              <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" stroke-linejoin="round" />
            </svg>
            Type
          </button>
        )}
        <button type="button" class={`${BUTTON_STYLES.small} shrink-0`} title="Remove goal" aria-label="Remove goal" onClick={props.onRemove}>
          ✕
        </button>
      </div>

      {open && (
        <div id={panelId} class="space-y-2 pr-3 pb-3 pl-3 sm:pl-[4.5rem]">
          {known && <p class={HINT_STYLE}>{GOAL_INFO[goal.type as GoalType].summary}</p>}
          {fields.length > 0 && (
            <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
              {fields.includes("temperature") && (
                <NumberField
                  label={FIELD_LABELS.temperature}
                  unit="°C"
                  value={goal.temperature}
                  invalid={problemsAt("temperature").length > 0}
                  onChange={(v) => set("temperature", v)}
                />
              )}
              {fields.includes("minutes") && (
                <NumberField
                  label={FIELD_LABELS.minutes}
                  unit="min"
                  value={goal.minutes}
                  integer
                  invalid={problemsAt("minutes").length > 0}
                  onChange={(v) => set("minutes", v)}
                />
              )}
              {goal.type === "Rest" && (
                <label class="col-start-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    class="size-4 shrink-0 accent-berry"
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
            <div class="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <span>Fields this goal type does not take: {unknownFields.map((f) => `"${f}"`).join(", ")}</span>
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
        </div>
      )}

      {choosing && (
        <GoalTypeDialog
          title={`Type of goal ${index + 1}`}
          current={known ? goal.type : undefined}
          onCancel={() => setChoosing(false)}
          onChoose={(type) => {
            setChoosing(false);
            if (type !== goal.type) {
              props.onChange(changeGoalType(goal, type));
            }
          }}
        />
      )}
    </li>
  );
}
