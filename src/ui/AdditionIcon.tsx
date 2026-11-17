/**
 * What goes into the boil, as an icon (EDT-054, QE-46): a hop cone for a hop, a jar for another addition (EDT-060).
 * The fill is the row's colour, so a hop keeps its donut colour (EDT-047) and the icon still maps to the charts.
 * Usable on its own or inside an SVG chart (`x`, `y`: its top left there).
 */

export type AdditionKind = "hops" | "others";

export function AdditionIcon(props: { kind: AdditionKind; colour: string; size?: number; x?: number; y?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      x={props.x}
      y={props.y}
      aria-hidden="true"
      data-addition-icon={props.kind === "hops" ? "hop" : "other"}
      fill={props.colour}
      class="shrink-0 overflow-visible"
    >
      {props.kind === "hops" ? (
        <>
          {/* The stem, then the cone with its bracts. */}
          <path d="M8 0.6 Q8.4 1.8 8 3" fill="none" stroke={props.colour} stroke-width={1.4} stroke-linecap="round" />
          <path
            d="M8 2.4 C12.9 3.4 14 9.2 8 15.6 C2 9.2 3.1 3.4 8 2.4 Z"
            class="stroke-white dark:stroke-surface-dark"
            stroke-width={0.9}
          />
          {/* Three rows of overlapping bracts. */}
          <path
            d="M4.4 6 L8 8 L11.6 6 M3.9 9.2 L8 11.4 L12.1 9.2 M5.2 12.3 L8 14 L10.8 12.3"
            fill="none"
            stroke="white"
            stroke-opacity={0.8}
            stroke-width={0.95}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </>
      ) : (
        <>
          {/* A jar with its lid. */}
          <rect x={3.4} y={1.6} width={9.2} height={2.8} rx={0.9} class="stroke-white dark:stroke-surface-dark" stroke-width={0.8} />
          <path
            d="M4.2 5.2 H11.8 V13.2 A1.8 1.8 0 0 1 10 15 H6 A1.8 1.8 0 0 1 4.2 13.2 Z"
            class="stroke-white dark:stroke-surface-dark"
            stroke-width={0.8}
          />
          <path d="M6 8.6 H10" fill="none" stroke="white" stroke-opacity={0.75} stroke-width={0.9} stroke-linecap="round" />
        </>
      )}
    </svg>
  );
}
