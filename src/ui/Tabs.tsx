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
  /** Each tab's errors and warnings (EDT-063): a red count, an amber ⚠ count. */
  badges?: Partial<Record<Id, { errors: number; warnings: number }>>;
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
                "relative -mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors " +
                "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-berry-light " +
                (active
                  ? "border-berry-light text-ink dark:text-ink-light"
                  : "border-transparent text-muted hover:text-ink dark:text-muted-dark dark:hover:text-ink-light")
              }
              onClick={() => props.onSelect(tab.id)}
            >
              {tab.label}
              {(() => {
                const b = props.badges?.[tab.id];
                if (!b || (b.errors === 0 && b.warnings === 0)) {
                  return null;
                }
                const said = [
                  b.errors > 0 ? `${b.errors} ${b.errors === 1 ? "error" : "errors"}` : "",
                  b.warnings > 0 ? `${b.warnings} ${b.warnings === 1 ? "warning" : "warnings"}` : "",
                ].filter(Boolean);
                return (
                  <span class="ml-1.5 inline-flex items-center gap-1 align-[1px]" data-tab-badge title={said.join(", ")}>
                    <span class="sr-only">({said.join(", ")})</span>
                    {b.errors > 0 && (
                      <span
                        aria-hidden="true"
                        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-bold text-white dark:bg-red-500"
                        data-tab-errors
                      >
                        {b.errors}
                      </span>
                    )}
                    {b.warnings > 0 && (
                      <span
                        aria-hidden="true"
                        class="inline-flex h-4 items-center rounded-full bg-amber-100 px-1 text-[10px] leading-none font-bold text-amber-800 dark:bg-brass-light/20 dark:text-brass-light"
                        data-tab-warnings
                      >
                        ⚠ {b.warnings}
                      </span>
                    )}
                  </span>
                );
              })()}
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
