/**
 * Where the beer colour lies among common beers (EDT-055, QE-37): the SRM colour chart as a bar from 0 to 80 EBC, a
 * marker at the beer's colour, the scale's numbers and common styles at their typical colour, and the styles whose
 * range holds it.
 */

import { BEER_STYLES, COLOUR_SCALE_MAX, SRM_COLOURS, stylesOfColour } from "../brewMath";
import { useWidth } from "./useWidth";

export function BeerColourScale(props: { ebc: number }) {
  const { box, width } = useWidth();
  const pad = 10;
  const barY = 10;
  const barH = 12;
  const x = (ebc: number) => pad + (Math.min(Math.max(ebc, 0), COLOUR_SCALE_MAX) / COLOUR_SCALE_MAX) * (width - 2 * pad);
  const stops = SRM_COLOURS.map((colour, k) => ({ offset: Math.min(1, ((k + 1) * 1.97) / COLOUR_SCALE_MAX), colour }));
  const marker = x(props.ebc);
  const styles = stylesOfColour(props.ebc);
  // Style labels at their typical colour; one that would overlap the label before it goes to a second row.
  const rowEnds = [-Infinity, -Infinity];
  const labels = BEER_STYLES.filter((s) => s.scale).map((s) => {
    const at = x((s.min + s.max) / 2);
    const half = s.name.length * 2.9 + 4;
    const row = at - half >= rowEnds[0] ? 0 : 1;
    rowEnds[row] = at + half;
    return { name: s.name, at, row };
  });
  const height = labels.some((l) => l.row === 1) ? 74 : 62;
  return (
    <div ref={box} class="mt-2" data-colour-scale>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${Math.round(props.ebc)} EBC on a scale from 0 to ${COLOUR_SCALE_MAX} EBC${styles.length ? `, like ${styles.join(", ")}` : ""}`}
        class="block max-w-full"
      >
        <defs>
          <linearGradient id="srm-scale" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color={SRM_COLOURS[0]} />
            {stops.map((s) => (
              <stop key={s.offset} offset={s.offset} stop-color={s.colour} />
            ))}
          </linearGradient>
        </defs>
        <rect x={pad} y={barY} width={width - 2 * pad} height={barH} rx={4} fill="url(#srm-scale)" />
        {[0, 20, 40, 60, COLOUR_SCALE_MAX].map((t) => (
          <text key={t} x={x(t)} y={barY + barH + 11} text-anchor="middle" class="fill-stone-500 text-[9px] dark:fill-stone-400">
            {t === COLOUR_SCALE_MAX ? `${t}+` : t}
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
        <g data-colour-marker>
          <path d={`M ${marker - 5} 1 L ${marker + 5} 1 L ${marker} ${barY - 1} Z`} class="fill-ink dark:fill-ink-light" />
          <line x1={marker} x2={marker} y1={barY - 2} y2={barY + barH + 2} stroke-width={2} class="stroke-ink dark:stroke-ink-light" />
        </g>
      </svg>
      <p class="text-xs text-stone-600 dark:text-stone-300" data-colour-styles>
        {styles.length > 0
          ? `In the range of: ${styles.join(", ")}.`
          : props.ebc > COLOUR_SCALE_MAX
            ? "Darker than a typical stout."
            : "Between the common styles."}
      </p>
    </div>
  );
}
