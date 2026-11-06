/** After sign-in: offer to save the recipes drafted in this browser to Google Drive. */

import { useState } from "preact/hooks";
import { problemsOf, titleOf, type Doc } from "../doc";
import { Modal } from "./Modal";
import { BUTTON_STYLES, SELECT_STYLE } from "./styles";

export type MigrateChoice = "save" | "overwrite" | "copy" | "skip";

export function defaultChoice(doc: Doc, driveIds: Set<string>): MigrateChoice {
  if (problemsOf(doc).length > 0) {
    return "skip";
  }
  return driveIds.has(doc.id) ? "copy" : "save";
}

export function MigrateDialog(props: {
  drafts: Doc[];
  driveIds: Set<string>;
  busy: boolean;
  onSave: (choices: Map<string, MigrateChoice>) => void;
  onLater: () => void;
}) {
  const [choices, setChoices] = useState(() => new Map(props.drafts.map((d) => [d.key, defaultChoice(d, props.driveIds)])));
  const count = [...choices.values()].filter((c) => c !== "skip").length;
  return (
    <Modal
      wide
      title="Save the recipes from this browser to Google Drive?"
      buttons={
        <>
          <button type="button" class={BUTTON_STYLES.secondary} disabled={props.busy} onClick={props.onLater}>
            Not now
          </button>
          <button type="button" class={BUTTON_STYLES.primary} disabled={props.busy || count === 0} onClick={() => props.onSave(choices)}>
            Save {count} to Google Drive
          </button>
        </>
      }
    >
      <p>
        You have {props.drafts.length} recipe{props.drafts.length === 1 ? "" : "s"} stored only in this browser. Saved ones
        are removed from the browser; skipped ones stay there and show again when you sign out.
      </p>
      <ul class="mt-4 divide-y divide-stone-200 dark:divide-white/10">
        {props.drafts.map((doc) => {
          const incomplete = problemsOf(doc).length > 0;
          const exists = props.driveIds.has(doc.id);
          return (
            <li key={doc.key} class="flex flex-wrap items-center justify-between gap-2 py-2">
              <span class="min-w-0">
                <span class="block truncate font-medium text-ink dark:text-ink-light">{titleOf(doc)}</span>
                <span class="text-xs">
                  {doc.id ? `${doc.id}.json` : "no file name"}
                  {incomplete ? " — incomplete, stays in this browser" : exists ? " — a file with this name is already in Google Drive" : ""}
                </span>
              </span>
              <select
                class={SELECT_STYLE}
                disabled={incomplete || props.busy}
                aria-label={`What to do with ${titleOf(doc)}`}
                value={choices.get(doc.key)}
                onChange={(e) => setChoices(new Map(choices).set(doc.key, e.currentTarget.value as MigrateChoice))}
              >
                {!incomplete && !exists && <option value="save">Save</option>}
                {!incomplete && exists && <option value="copy">Save as a copy</option>}
                {!incomplete && exists && <option value="overwrite">Overwrite the file in Google Drive</option>}
                <option value="skip">Keep in this browser</option>
              </select>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
