/**
 * The add action as the last row of a list or table (EDT-012, EDT-042; product owner, 2026-11-10): a full-width
 * button in the brand colour with a round "+", below a dashed line. Its text stays "+ Add …" (the "+" is the icon).
 */

export const ADD_ROW_LINE = "border-t border-dashed border-line dark:border-white/15";

export function AddRowButton(props: { label: string; onClick: () => void; class?: string }) {
  return (
    <button
      type="button"
      data-add-row
      onClick={props.onClick}
      class={
        "flex w-full items-center gap-2 px-2 py-2.5 text-left text-sm font-semibold text-berry sm:px-3 " +
        "hover:bg-berry-light/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-berry-light " +
        "dark:text-berry-light " +
        (props.class ?? "")
      }
    >
      <span
        aria-hidden="true"
        class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-berry-light/20 text-base leading-none"
      >
        +
      </span>{" "}
      {props.label}
    </button>
  );
}
