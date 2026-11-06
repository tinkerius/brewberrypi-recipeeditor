/** Choosing a goal's type (EDT-017): every goal type with its display name and explanation. */

import { useEffect, useRef } from "preact/hooks";
import { GOAL_INFO, GOAL_TYPES, type GoalType } from "../model";
import { Modal } from "./Modal";
import { BUTTON_STYLES } from "./styles";

export function GoalTypeDialog(props: {
  title: string;
  /** The goal's current type, marked in the list. */
  current?: string;
  onChoose: (type: GoalType) => void;
  onCancel: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  // Focus the current type (or the first): the dialog is used with the keyboard too.
  useEffect(() => {
    (list.current?.querySelector<HTMLButtonElement>("[aria-current=true]") ?? list.current?.querySelector("button"))?.focus();
  }, []);
  return (
    <Modal
      wide
      title={props.title}
      onEscape={props.onCancel}
      buttons={
        <button type="button" class={BUTTON_STYLES.secondary} onClick={props.onCancel}>
          Cancel
        </button>
      }
    >
      <ul ref={list} class="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Goal types">
        {GOAL_TYPES.map((type) => {
          const current = type === props.current;
          return (
            <li key={type}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                class={
                  "h-full w-full rounded-lg p-3 text-left ring-1 transition hover:bg-stone-50 " +
                  "focus-visible:outline-2 focus-visible:outline-berry dark:hover:bg-white/5 dark:focus-visible:outline-berry-light " +
                  (current
                    ? "ring-2 ring-berry dark:ring-berry-light"
                    : "ring-stone-200 dark:ring-white/10")
                }
                onClick={() => props.onChoose(type)}
              >
                <span class="block text-sm font-semibold text-ink dark:text-ink-light">
                  {GOAL_INFO[type].label} <span class="font-normal text-stone-500 dark:text-stone-400">({type})</span>
                </span>
                <span class="mt-1 block text-xs text-stone-600 dark:text-stone-300">{GOAL_INFO[type].summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
