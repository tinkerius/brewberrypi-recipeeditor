/** The recipes of the current place (browser drafts or Google Drive), with their state. */

import { hasPendingChanges, problemsOf, titleOf, type Doc } from "../doc";

export function RecipeList(props: {
  docs: Doc[];
  selectedKey: string | undefined;
  pendingLabel: string;
  onSelect: (key: string) => void;
}) {
  if (props.docs.length === 0) {
    return <p class="px-1 py-4 text-sm text-stone-500 dark:text-stone-400">No recipes yet.</p>;
  }
  return (
    <ul class="space-y-1" aria-label="Recipes">
      {props.docs.map((doc) => {
        const selected = doc.key === props.selectedKey;
        const invalid = doc.loaded && (doc.loadError !== undefined || problemsOf(doc).length > 0);
        const pending = hasPendingChanges(doc);
        return (
          <li key={doc.key}>
            <button
              type="button"
              aria-current={selected ? "true" : undefined}
              class={
                "w-full rounded-lg px-3 py-2 text-left text-sm transition " +
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
          </li>
        );
      })}
    </ul>
  );
}
