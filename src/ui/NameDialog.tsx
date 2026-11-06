/** Asks for a recipe's file name (its id): when a recipe is created, duplicated or renamed. */

import { useState } from "preact/hooks";
import { validateId } from "../validate";
import { Modal } from "./Modal";
import { BUTTON_STYLES, HINT_STYLE, INPUT_STYLE, INVALID_INPUT } from "./styles";

/** Why the file name can't be used, or undefined when it can. */
export function fileNameProblem(id: string, taken: ReadonlySet<string>): string | undefined {
  const [problem] = validateId(id);
  if (problem) {
    return problem.message;
  }
  return taken.has(id) ? `There already is a recipe ${id}.json.` : undefined;
}

export function NameDialog(props: {
  title: string;
  initial: string;
  /** Ids of the other recipes. */
  taken: ReadonlySet<string>;
  confirmLabel: string;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState(props.initial);
  const [touched, setTouched] = useState(false);
  const problem = fileNameProblem(id.trim(), props.taken);
  const confirm = () => {
    setTouched(true);
    if (!problem) {
      props.onConfirm(id.trim());
    }
  };
  const showProblem = problem && (touched || id !== "");
  return (
    <Modal
      title={props.title}
      buttons={
        <>
          <button type="button" class={BUTTON_STYLES.secondary} onClick={props.onCancel}>
            Cancel
          </button>
          <button type="button" class={BUTTON_STYLES.primary} disabled={!!problem && touched} onClick={confirm}>
            {props.confirmLabel}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            props.onCancel();
          }
        }}
      >
        <label class="block">
          <span class="block text-xs font-medium text-stone-600 dark:text-stone-300">File name (recipe id)</span>
          <div class="mt-1 flex items-center gap-1">
            <input
              type="text"
              class={`${INPUT_STYLE} ${showProblem ? INVALID_INPUT : ""}`}
              value={id}
              placeholder="e.g. Weizen"
              spellcheck={false}
              autocomplete="off"
              autoFocus
              aria-invalid={showProblem ? "true" : undefined}
              onFocus={(e) => e.currentTarget.select()}
              onInput={(e) => setId(e.currentTarget.value)}
            />
            <span class="text-sm text-stone-500">.json</span>
          </div>
        </label>
        <p class={`mt-2 ${showProblem ? "text-xs text-red-600 dark:text-red-400" : HINT_STYLE}`} role={showProblem ? "alert" : undefined}>
          {showProblem ? problem : "Letters A–Z, digits, _ and -. The BrewberryPi app lists recipes by this name."}
        </p>
      </form>
    </Modal>
  );
}
