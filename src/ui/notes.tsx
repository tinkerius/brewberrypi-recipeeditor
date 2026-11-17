/**
 * Errors and warnings at their fields (EDT-062, QE-54). An error is missing or wrong data (a problem, FMT-004: red, ⊘,
 * the recipe can't be saved); a warning a value outside its typical range (EDT-064: amber, ⚠, the recipe stays valid).
 */

import type { Problem } from "../validate";
import type { Warning } from "../warnings";

export interface Note {
  kind: "error" | "warning";
  text: string;
}

/** What a recipe's fields are told: its problems and its warnings. */
export interface Issues {
  problems: Problem[];
  warnings: Warning[];
}

/** A problem's message at its field: without the row's name the field stands in ("Hop 1, addition 2 …" → "Addition 2 …"). */
export function fieldText(message: string): string {
  const m = /^(?:Malt|Hop|Other addition) \d+(?:, addition (\d+))?(:? )(.*)$/s.exec(message);
  if (!m) {
    return message;
  }
  const [, addition, sep, rest] = m;
  if (addition !== undefined) {
    return `Addition ${addition}${sep}${rest}`;
  }
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** The notes of one field (its exact path). */
export function notesAt(issues: Issues, path: string): Note[] {
  return notesWhere(issues, (p) => p === path);
}

/** The notes of every path a test accepts: errors first, then warnings. */
export function notesWhere(issues: Issues, test: (path: string) => boolean): Note[] {
  return [
    ...issues.problems.filter((p) => test(p.path)).map((p): Note => ({ kind: "error", text: fieldText(p.message) })),
    ...issues.warnings.filter((w) => test(w.path)).map((w): Note => ({ kind: "warning", text: w.short })),
  ];
}

export const hasError = (notes: Note[]) => notes.some((n) => n.kind === "error");
export const hasWarning = (notes: Note[]) => notes.some((n) => n.kind === "warning");

export const ERROR_TEXT = "text-red-700 dark:text-red-300";
export const WARNING_TEXT = "text-amber-700 dark:text-brass-light";

/** The notes as lines: an error with ⊘ in red, a warning (its text starts with ⚠) in amber. */
export function FieldNotes(props: { notes: Note[]; class?: string }) {
  if (props.notes.length === 0) {
    return null;
  }
  return (
    <span class={`block space-y-0.5 text-[11px] leading-snug font-medium sm:text-xs ${props.class ?? ""}`} data-field-notes>
      {props.notes.map((n, i) =>
        n.kind === "error" ? (
          <span key={i} class={`block ${ERROR_TEXT}`} data-field-error>
            <span aria-hidden="true">⊘ </span>
            {n.text}
          </span>
        ) : (
          <span key={i} class={`block ${WARNING_TEXT}`} data-field-warning>
            {n.text}
          </span>
        ),
      )}
    </span>
  );
}
