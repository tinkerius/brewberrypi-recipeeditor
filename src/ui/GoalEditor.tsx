/** One goal of a recipe: its type and the fields that type takes (spec 04, 07 §7.2). */

import { FIELD_LABELS, GOAL_INFO, GOAL_TYPES, changeGoalType, goalFields, isGoalType, type Goal } from "../model";
import type { Problem } from "../validate";
import { NumberField, TextField } from "./fields";
import { BUTTON_STYLES, HINT_STYLE, SELECT_STYLE } from "./styles";

export function GoalEditor(props: {
  goal: Goal;
  index: number;
  count: number;
  problems: Problem[];
  onChange: (goal: Goal) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { goal, index } = props;
  const at = `goals[${index}]`;
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
    <li class="rounded-lg p-3 ring-1 ring-stone-200 sm:p-4 dark:ring-white/10">
      <div class="flex flex-wrap items-center gap-2">
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
          <button type="button" class={BUTTON_STYLES.small} title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => props.onMove(-1)}>
            ↑
          </button>
          <button
            type="button"
            class={BUTTON_STYLES.small}
            title="Move down"
            aria-label="Move down"
            disabled={index === props.count - 1}
            onClick={() => props.onMove(1)}
          >
            ↓
          </button>
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
