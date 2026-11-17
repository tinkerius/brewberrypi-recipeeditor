/**
 * The total water against the knockout volume as a donut (EDT-074, QE-81, QE-82), like the hops' shares (EDT-047):
 * the ring is the total water, with the total in its middle; one slice is the knockout volume (the wort that comes
 * out), the other the losses (total water − knockout volume); a tooltip per slice, and a legend under "Total water"
 * with its ⓘ (the estimate as its typical value, EDT-067).
 */

import { formatShare } from "../model";
import { INFO_PANEL, InfoButton, InfoContent, type Info } from "./info";

/** The slices' colours (EDT-074): the wort amber, the losses a neutral grey; a plain ring without a knockout volume. */
const COLOURS = {
  knockout: { stroke: "stroke-brass dark:stroke-brass-light", swatch: "bg-brass dark:bg-brass-light" },
  losses: { stroke: "stroke-stone-300 dark:stroke-stone-500", swatch: "bg-stone-300 dark:bg-stone-500" },
  plain: { stroke: "stroke-stone-200 dark:stroke-stone-600", swatch: "" },
};

type Slice = { key: keyof typeof COLOURS; label: string; litres: number };

/** One decimal, without a trailing ".0": "13.5", "18". */
const oneDecimal = (value: number) => String(Math.round(value * 10) / 10);

export function WaterDonut(props: {
  /** The total water, above 0. */
  total: number;
  /** The knockout volume, if entered. */
  knockout?: number;
  info: Info;
  open: boolean;
  onToggle: () => void;
}) {
  const { total, knockout } = props;
  const slices: Slice[] =
    knockout === undefined
      ? [{ key: "plain", label: "Total water", litres: total }]
      : knockout >= total
        ? [{ key: "knockout", label: "Knockout volume", litres: total }]
        : [
            { key: "knockout", label: "Knockout volume", litres: knockout },
            { key: "losses", label: "Losses", litres: total - knockout },
          ];
  const note =
    knockout === undefined
      ? "Enter the knockout volume to see the losses."
      : knockout > total
        ? "The knockout volume is more than the total water."
        : undefined;
  // The legend only for a real comparison: not for a plain ring, nor for a knockout volume above the total.
  const legend = knockout === undefined || knockout > total ? [] : slices;
  const share = (litres: number) => formatShare((litres / total) * 100);
  const size = 132;
  const r = 52;
  const width = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <figure class="flex flex-wrap items-start gap-x-6 gap-y-3" data-water-chart>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          `Total water ${oneDecimal(total)} L` +
          (legend.length ? `: ${legend.map((s) => `${s.label} ${oneDecimal(s.litres)} L`).join(", ")}` : "")
        }
        class="shrink-0 -rotate-90"
      >
        {slices.map((s) => {
          const length = (s.litres / total) * circumference;
          // A 2px gap of the surface between slices; none for a single slice (a full ring).
          const gap = slices.length > 1 ? Math.min(2, length / 2) : 0;
          const drawn = Math.max(0, length - gap);
          const circle = (
            <circle
              key={s.key}
              data-water-slice={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke-width={width}
              stroke-dasharray={`${drawn} ${circumference - drawn}`}
              stroke-dashoffset={-offset}
              class={`${COLOURS[s.key].stroke} transition-opacity hover:opacity-80`}
            >
              {s.key !== "plain" && <title>{`${s.label}: ${oneDecimal(s.litres)} L, ${share(s.litres)}`}</title>}
            </circle>
          );
          offset += length;
          return circle;
        })}
        <text
          x={size / 2}
          y={size / 2}
          dy="0.35em"
          text-anchor="middle"
          transform={`rotate(90 ${size / 2} ${size / 2})`}
          class="fill-ink text-[13px] font-semibold dark:fill-ink-light"
          data-total-water
        >
          {oneDecimal(total)} L
        </text>
      </svg>
      <figcaption class="min-w-0 max-w-xs">
        <p class="mb-1.5 flex items-center gap-2 text-sm font-medium text-ink dark:text-ink-light">
          Total water
          <InfoButton open={props.open} label="About: Total water" controls="figure-info-total-water" onClick={props.onToggle} />
        </p>
        {props.open && (
          <div id="figure-info-total-water" class={`mb-2 ${INFO_PANEL}`} data-figure-info="total-water">
            <InfoContent info={props.info} />
          </div>
        )}
        {legend.length > 0 && (
          <ul class="space-y-1 text-sm" data-water-legend>
            {legend.map((s) => (
              <li key={s.key} class="flex items-center gap-2" data-water-legend-item={s.key}>
                <span aria-hidden="true" class={`size-3 shrink-0 rounded-sm ${COLOURS[s.key].swatch}`} />
                <span class="text-ink dark:text-ink-light">{s.label}</span>
                <span class="tabular-nums text-ink dark:text-ink-light">{oneDecimal(s.litres)} L</span>
                <span class="tabular-nums text-stone-500 dark:text-stone-400">{share(s.litres)}</span>
              </li>
            ))}
          </ul>
        )}
        {note && (
          <p class="text-xs text-stone-500 dark:text-stone-400" data-water-note>
            {note}
          </p>
        )}
      </figcaption>
    </figure>
  );
}
