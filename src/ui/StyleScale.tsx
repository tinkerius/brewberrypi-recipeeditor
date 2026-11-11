/**
 * Where a figure lies among common beers (EDT-055, EDT-056): a bar from 0 to `max` in the figure's colours, a marker
 * at the beer's value (a higher one at the bar's end), the scale's numbers and common styles at their typical value
 * (staggered onto a second row where they would collide), and the styles whose range holds it.
 */

import { BEER_STYLES, BITTERNESS_SCALE_MAX, BITTERNESS_STYLES, COLOUR_SCALE_MAX, SRM_COLOURS, stylesOfBitterness, stylesOfColour } from "../brewMath";
import { useWidth } from "./useWidth";

type Style = { name: string; min: number; max: number; scale: boolean };

function StyleScale(props: {
  kind: "colour" | "bitterness";
  value: number;
  unit: string;
  max: number;
  stops: { offset: number; colour: string }[];
  styles: Style[];
  holding: string[];
  above: string;
}) {
  const { box, width } = useWidth();
  const pad = 10;
  const barY = 10;
  const barH = 12;
  const x = (v: number) => pad + (Math.min(Math.max(v, 0), props.max) / props.max) * (width - 2 * pad);
  const marker = x(props.value);
  const rowEnds = [-Infinity, -Infinity];
  const labels = props.styles
    .filter((s) => s.scale)
    .map((s) => {
      const at = x((s.min + s.max) / 2);
      const half = s.name.length * 2.9 + 4;
      const row = at - half >= rowEnds[0] ? 0 : 1;
      rowEnds[row] = at + half;
      return { name: s.name, at, row };
    });
  const height = labels.some((l) => l.row === 1) ? 74 : 62;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * props.max));
  const gradient = `${props.kind}-scale-gradient`;
  const shown = Math.round(props.value);
  return (
    <div ref={box} class="mt-2" data-style-scale={props.kind}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${shown} ${props.unit} on a scale from 0 to ${props.max} ${props.unit}${props.holding.length ? `, like ${props.holding.join(", ")}` : ""}`}
        class="block max-w-full"
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="1" y1="0" y2="0">
            {props.stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stop-color={s.colour} />
            ))}
          </linearGradient>
        </defs>
        <rect x={pad} y={barY} width={width - 2 * pad} height={barH} rx={4} fill={`url(#${gradient})`} />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={barY + barH + 11} text-anchor="middle" class="fill-stone-500 text-[9px] dark:fill-stone-400">
            {t === props.max ? `${t}+` : t}
          </text>
        ))}
        {labels.map(({ name, at, row }) => (
          <g key={name} data-scale-style={name}>
            <line x1={at} x2={at} y1={barY + barH + 14} y2={barY + barH + 18 + row * 12} class="stroke-stone-400 dark:stroke-stone-500" />
            <text x={at} y={barY + barH + 28 + row * 12} text-anchor="middle" class="fill-stone-600 text-[10px] dark:fill-stone-300">
              {name}
            </text>
          </g>
        ))}
        {/* The beer: a marker across the bar with a pointer above it. */}
        <g data-scale-marker>
          <path d={`M ${marker - 5} 1 L ${marker + 5} 1 L ${marker} ${barY - 1} Z`} class="fill-ink dark:fill-ink-light" />
          <line x1={marker} x2={marker} y1={barY - 2} y2={barY + barH + 2} stroke-width={2} class="stroke-ink dark:stroke-ink-light" />
        </g>
      </svg>
      <p class="text-xs text-stone-600 dark:text-stone-300" data-scale-styles>
        {props.holding.length > 0
          ? `In the range of: ${props.holding.join(", ")}.`
          : props.value > props.max
            ? props.above
            : "Between the common styles."}
      </p>
    </div>
  );
}

/** The beer colour among common beers (EDT-055): the SRM colour chart from 0 to 80 EBC. */
export function BeerColourScale(props: { ebc: number }) {
  const stops = [
    { offset: 0, colour: SRM_COLOURS[0] },
    ...SRM_COLOURS.map((colour, k) => ({ offset: Math.min(1, ((k + 1) * 1.97) / COLOUR_SCALE_MAX), colour })),
  ];
  return (
    <StyleScale
      kind="colour"
      value={props.ebc}
      unit="EBC"
      max={COLOUR_SCALE_MAX}
      stops={stops}
      styles={BEER_STYLES}
      holding={stylesOfColour(props.ebc)}
      above="Darker than a typical stout."
    />
  );
}

/** The bitterness among common beers (EDT-056): from light to dark hop green, 0 to 100 IBU. */
export function BitternessScale(props: { ibu: number }) {
  const stops = [
    { offset: 0, colour: "#eef5e8" },
    { offset: 0.35, colour: "#8fc77f" },
    { offset: 0.7, colour: "#3d7a3c" },
    { offset: 1, colour: "#1f3f1f" },
  ];
  return (
    <StyleScale
      kind="bitterness"
      value={props.ibu}
      unit="IBU"
      max={BITTERNESS_SCALE_MAX}
      stops={stops}
      styles={BITTERNESS_STYLES}
      holding={stylesOfBitterness(props.ibu)}
      above="More bitter than a typical IPA."
    />
  );
}
