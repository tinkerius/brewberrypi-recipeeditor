/** The recipes of the current place (browser drafts or Google Drive), with their state and a menu per recipe. */

import { useEffect, useRef, useState } from "preact/hooks";
import { hasPendingChanges, problemsOf, titleOf, type Doc } from "../doc";

export type RecipeAction = "rename" | "duplicate" | "download" | "delete";

const ACTIONS: { action: RecipeAction; label: string; danger?: boolean }[] = [
  { action: "rename", label: "Rename…" },
  { action: "duplicate", label: "Duplicate…" },
  { action: "download", label: "Download" },
  { action: "delete", label: "Delete…", danger: true },
];

function RecipeMenu(props: { title: string; onAction: (action: RecipeAction) => void; onClose: () => void }) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector("button")?.focus();
    const close = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) {
        props.onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        props.onClose();
      }
    };
    // Registered after the click that opened the menu.
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", close);
      document.addEventListener("contextmenu", close);
    });
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div
      ref={menu}
      role="menu"
      aria-label={`Actions for ${props.title}`}
      class="absolute top-full right-1 z-10 mt-1 w-44 rounded-lg bg-white py-1 shadow-lg ring-1 ring-ink/10 dark:bg-surface-dark dark:ring-white/15"
      onKeyDown={(e) => {
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
        const at = items.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
        }
      }}
    >
      {ACTIONS.map(({ action, label, danger }) => (
        <button
          key={action}
          type="button"
          role="menuitem"
          class={
            "block w-full px-3 py-2 text-left text-sm hover:bg-stone-100 focus:bg-stone-100 focus:outline-none dark:hover:bg-white/10 dark:focus:bg-white/10 " +
            (danger ? "text-red-600 dark:text-red-400" : "text-ink dark:text-ink-light")
          }
          onClick={() => {
            props.onClose();
            props.onAction(action);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RecipeList(props: {
  docs: Doc[];
  selectedKey: string | undefined;
  pendingLabel: string;
  onSelect: (key: string) => void;
  onAction: (doc: Doc, action: RecipeAction) => void;
}) {
  const [menuFor, setMenuFor] = useState<string>();
  if (props.docs.length === 0) {
    return <p class="px-1 py-4 text-sm text-stone-500 dark:text-stone-400">No recipes yet.</p>;
  }
  return (
    <ul class="space-y-1" aria-label="Recipes">
      {props.docs.map((doc) => {
        const selected = doc.key === props.selectedKey;
        const invalid = doc.loaded && (doc.loadError !== undefined || problemsOf(doc).length > 0);
        const pending = hasPendingChanges(doc);
        const open = menuFor === doc.key;
        return (
          <li
            key={doc.key}
            class="group relative"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuFor(doc.key);
            }}
          >
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              class={
                "w-full rounded-lg py-2 pr-10 pl-3 text-left text-sm transition " +
                (selected
                  ? "bg-berry/10 ring-1 ring-berry/40 dark:bg-berry-light/15 dark:ring-berry-light/40"
                  : "hover:bg-stone-100 dark:hover:bg-white/5")
              }
              onClick={() => props.onSelect(doc.key)}
            >
              <span class="block truncate font-medium text-ink dark:text-ink-light">{titleOf(doc)}</span>
              <span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-stone-400">
                <span class="truncate">{doc.id ? `${doc.id}.json` : "no file name"}</span>
                {invalid && <span class="font-medium text-brass dark:text-brass-light">incomplete</span>}
                {pending && <span class="font-medium text-berry dark:text-berry-light">{props.pendingLabel}</span>}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Actions for ${titleOf(doc)}`}
              aria-haspopup="menu"
              aria-expanded={open ? "true" : "false"}
              class={
                "absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-md text-stone-500 transition " +
                "hover:bg-stone-200 focus-visible:opacity-100 dark:text-stone-400 dark:hover:bg-white/10 " +
                (open || selected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100")
              }
              onClick={() => setMenuFor(open ? undefined : doc.key)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" class="size-4 fill-current">
                <circle cx="4" cy="10" r="1.6" />
                <circle cx="10" cy="10" r="1.6" />
                <circle cx="16" cy="10" r="1.6" />
              </svg>
            </button>
            {open && <RecipeMenu title={titleOf(doc)} onAction={(action) => props.onAction(doc, action)} onClose={() => setMenuFor(undefined)} />}
          </li>
        );
      })}
    </ul>
  );
}
