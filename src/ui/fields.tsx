/** Form fields that keep what the user is typing, even while it is not a valid number yet. */

import { useEffect, useState } from "preact/hooks";
import { INPUT_STYLE, INVALID_INPUT, LABEL_STYLE } from "./styles";

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
    <label class="block">
      <span class={LABEL_STYLE}>{props.label}</span>
      <input
        type="text"
        inputMode={props.integer ? "numeric" : "decimal"}
        class={`${INPUT_STYLE} mt-1 ${props.invalid ? INVALID_INPUT : ""}`}
        value={text}
        onInput={(e) => {
          const next = e.currentTarget.value;
          setText(next);
          const parsed = parseNumber(next);
          // Not a number: keep the text, so the validator reports it ("must be a number").
          props.onChange(parsed === undefined ? undefined : Number.isNaN(parsed) ? next : parsed);
        }}
      />
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: unknown;
  invalid: boolean;
  multiline?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const value = typeof props.value === "string" ? props.value : "";
  const cls = `${INPUT_STYLE} mt-1 ${props.invalid ? INVALID_INPUT : ""}`;
  return (
    <label class="block">
      <span class={LABEL_STYLE}>{props.label}</span>
      {props.multiline ? (
        <textarea
          class={cls}
          rows={2}
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
