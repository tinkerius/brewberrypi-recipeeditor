/**
 * Form fields of an open goal (EDT-011), as rows of a two-column grid: the label left, the field right. The label
 * element uses `display: contents`, so it still names its field. Number fields keep what the user is typing, even
 * while it is not a valid number yet (EDT-015).
 */

import { useEffect, useState } from "preact/hooks";
import { INPUT_STYLE, INVALID_INPUT, LABEL_STYLE, WARN_INPUT } from "./styles";

function parseNumber(text: string): number | undefined {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function NumberField(props: {
  label: string;
  value: unknown;
  invalid: boolean;
  integer?: boolean;
  /** Shown after the field, e.g. "°C". */
  unit?: string;
  /** In a table cell (EDT-031): the label is only for screen readers, the field narrower. */
  compact?: boolean;
  /** Marks the field as worth a second look (a warning, not a problem; EDT-033). */
  warn?: boolean;
  /** The id of a hint that describes the field (e.g. its typical values). */
  describedBy?: string;
  onChange: (value: number | string | undefined) => void;
}) {
  const shown = typeof props.value === "number" || typeof props.value === "string" ? String(props.value) : "";
  const [text, setText] = useState(shown);
  // Follow changes from outside (undo of the type, another recipe), not the echo of our own input.
  useEffect(() => {
    if (parseNumber(text) !== parseNumber(shown) && !(Number.isNaN(parseNumber(text)) && shown === text)) {
      setText(shown);
    }
  }, [shown]);
  return (
    <label class="contents">
      <span class={props.compact ? "sr-only" : LABEL_STYLE}>{props.label}</span>
      <span class="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
        <input
          type="text"
          inputMode={props.integer ? "numeric" : "decimal"}
          aria-describedby={props.describedBy}
          class={
            `${INPUT_STYLE} ${props.compact ? "w-11! px-1! sm:w-16! sm:px-2!" : "w-20!"} py-1.5! text-right ` +
            (props.invalid ? INVALID_INPUT : props.warn ? WARN_INPUT : "")
          }
          value={text}
          onInput={(e) => {
            const next = e.currentTarget.value;
            setText(next);
            const parsed = parseNumber(next);
            // Not a number: keep the text, so the validator reports it ("must be a number").
            props.onChange(parsed === undefined ? undefined : Number.isNaN(parsed) ? next : parsed);
          }}
        />
        {props.unit && <span class="whitespace-nowrap">{props.unit}</span>}
      </span>
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: unknown;
  invalid: boolean;
  multiline?: boolean;
  /** A multi-line field's height in lines (default 2). */
  rows?: number;
  placeholder?: string;
  /** In a table cell (EDT-042): the label is only for screen readers. */
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const value = typeof props.value === "string" ? props.value : "";
  const cls = `${INPUT_STYLE} py-1.5! ${props.invalid ? INVALID_INPUT : ""}`;
  return (
    <label class="contents">
      <span class={props.compact ? "sr-only" : LABEL_STYLE}>{props.label}</span>
      {props.multiline ? (
        <textarea
          class={cls}
          rows={props.rows ?? 2}
          value={value}
          placeholder={props.placeholder}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      ) : (
        <input
          type="text"
          class={cls}
          value={value}
          placeholder={props.placeholder}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      )}
    </label>
  );
}
