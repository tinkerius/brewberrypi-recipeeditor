/**
 * The recipe's sections as tabs (GUI-032, QE-28), after the ARIA tab pattern: a tab list, the selected tab, and its
 * panel. The arrow keys, Home and End move between tabs. So far a recipe has one tab; more come later.
 */

import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";

export interface Tab<Id extends string> {
  id: Id;
  label: string;
}

export function Tabs<Id extends string>(props: {
  label: string;
  tabs: readonly Tab<Id>[];
  selected: Id;
  onSelect: (id: Id) => void;
  children: ComponentChildren;
}) {
  const list = useRef<HTMLDivElement>(null);
  const select = (index: number) => {
    const tab = props.tabs[(index + props.tabs.length) % props.tabs.length];
    props.onSelect(tab.id);
    list.current?.querySelector<HTMLElement>(`#tab-${tab.id}`)?.focus();
  };
  const current = props.tabs.findIndex((t) => t.id === props.selected);
  return (
    <div class="mt-6">
      <div
        ref={list}
        role="tablist"
        aria-label={props.label}
        class="flex gap-1 overflow-x-auto border-b border-line dark:border-white/10"
        onKeyDown={(e) => {
          const moves: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: props.tabs.length - 1 };
          if (e.key in moves) {
            e.preventDefault();
            select(moves[e.key]);
          }
        }}
      >
        {props.tabs.map((tab) => {
          const active = tab.id === props.selected;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              class={
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors " +
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-berry-light " +
                (active
                  ? "border-berry-light text-ink dark:text-ink-light"
                  : "border-transparent text-muted hover:text-ink dark:text-muted-dark dark:hover:text-ink-light")
              }
              onClick={() => props.onSelect(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${props.selected}`} aria-labelledby={`tab-${props.selected}`} class="pt-4">
        {props.children}
      </div>
    </div>
  );
}
