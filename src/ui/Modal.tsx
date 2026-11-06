/** A modal dialog in the app's look. */

import type { ComponentChildren } from "preact";
import { TITLE_STYLE } from "./styles";

export function Modal(props: { title: string; children: ComponentChildren; buttons: ComponentChildren; wide?: boolean }) {
  return (
    <div class="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 pt-16 backdrop-blur-xs">
      <div
        class={`w-full ${props.wide ? "max-w-2xl" : "max-w-md"} rounded-xl bg-white p-6 shadow-xl ring-1 ring-ink/5 dark:bg-surface-dark dark:ring-white/10`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" class={TITLE_STYLE}>
          {props.title}
        </h2>
        <div class="mt-2 text-sm text-stone-600 dark:text-stone-300">{props.children}</div>
        <div class="mt-6 flex flex-wrap justify-end gap-2">{props.buttons}</div>
      </div>
    </div>
  );
}
