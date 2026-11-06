/** The recipe name as the title, edited in place (EDT-010): click it or the pencil; Enter or leaving keeps it. */

import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { INVALID_INPUT, TITLE_STYLE } from "./styles";

export function RecipeTitle(props: { docKey: string; name: string; invalid: boolean; onChange: (name: string) => void }) {
  // A recipe without a name (a new one) starts with the field open.
  const [editing, setEditing] = useState(props.name === "");
  const before = useRef(props.name);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditing(props.name === "");
  }, [props.docKey]);

  // Before the next keystroke can arrive (useEffect would be too late: typed text would get selected and replaced).
  useLayoutEffect(() => {
    if (editing) {
      before.current = props.name;
      input.current?.focus();
      input.current?.select();
    }
  }, [editing, props.docKey]);

  if (editing) {
    return (
      <input
        ref={input}
        type="text"
        aria-label="Recipe name"
        placeholder="Recipe name, e.g. Hefeweizen 12.5 °P"
        title="Shown in the app's process list"
        class={
          `${TITLE_STYLE} w-full rounded-md bg-white px-2 py-1 -ml-2 ring-1 ring-stone-300 ring-inset ` +
          "placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-berry " +
          `dark:bg-white/10 dark:ring-white/10 dark:focus-visible:outline-berry-light ${props.invalid ? INVALID_INPUT : ""}`
        }
        value={props.name}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            setEditing(false);
          } else if (e.key === "Escape") {
            e.preventDefault();
            props.onChange(before.current);
            setEditing(false);
          }
        }}
        onBlur={() => setEditing(false)}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={`Edit recipe name: ${props.name || "Untitled recipe"}`}
      title="Click to edit the recipe name (shown in the app's process list)"
      class="group -ml-2 flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-berry dark:hover:bg-white/5 dark:focus-visible:outline-berry-light"
      onClick={() => setEditing(true)}
    >
      <h2 class={`${TITLE_STYLE} truncate ${props.name ? "" : "text-stone-400 dark:text-stone-500"}`}>
        {props.name || "Untitled recipe"}
      </h2>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        class="size-4 shrink-0 fill-none stroke-current stroke-[1.6] text-stone-400 group-hover:text-berry dark:group-hover:text-berry-light"
      >
        <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" stroke-linejoin="round" />
      </svg>
    </button>
  );
}
