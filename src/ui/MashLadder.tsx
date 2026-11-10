/**
 * The mash temperature ladder (EDT-036..040, QE-33), above the Mashing table: the y-axis is the mash temperature.
 * At the left, every rest is a band over its typical temperature range in its own lane (overlapping ranges never
 * share one), its typical temperature ticked and its label beside it (labels are spread so they never collide).
 * At the right, the planned rests are drawn as the temperature profile over time: heating ramps at the heating
 * rate and the holds, over the bands of the planned rests, so it shows which enzymes work when. The limit of
 * 78 °C is a red line. Every value comes from `mashRests.ts` and the plan.
 */

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { MASH_RESTS, MASH_TEMPERATURE_LIMIT, MASH_REST_IDS, type MashRestId } from "../mashRests";
import {
  DEFAULT_HEATING_RATE,
  bandLanes,
  mashProfile,
  restsByTypical,
  scheduleWarnings,
  spreadLabels,
  stepsOf,
} from "../mashSchedule";
import { NumberField } from "./fields";
import { HINT_STYLE } from "./styles";

const HEIGHT = 300;
const TOP = 16;
const BOTTOM = 30;
const AXIS = 34;
const LANE = 10;
/** Below this width the schedule goes below the ladder (EDT-036). */
const NARROW = 560;

/** Minutes as "1 h 18 min" or "45 min". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
}

function tooltip(id: MashRestId): string {
  const info = MASH_RESTS[id];
  return [`${info.label}: ${info.range}`, ...info.about.map(([term, text]) => `${term}: ${text}`)].join("\n");
}

function useWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { box, width };
}

export function MashLadder(props: { plan: Record<string, unknown>; selected?: MashRestId; onSelect: (id: MashRestId) => void }) {
  const { box, width } = useWidth();
  const [rateValue, setRateValue] = useState<unknown>(DEFAULT_HEATING_RATE);
  const rate = typeof rateValue === "number" && rateValue > 0 ? rateValue : DEFAULT_HEATING_RATE;
  const steps = stepsOf(props.plan);
  const profile = mashProfile(steps, rate);
  const warnings = scheduleWarnings(steps);
  const planned = new Set(steps.map((s) => s.restId));

  // Temperature scale: every band, the limit and every step fit, in 5 °C steps.
  const temps = [
    ...MASH_REST_IDS.flatMap((id) => [MASH_RESTS[id].tempMin, MASH_RESTS[id].tempMax]),
    MASH_TEMPERATURE_LIMIT,
    ...steps.map((s) => s.targetTemp),
  ];
  const tMin = Math.floor((Math.min(...temps) - 3) / 5) * 5;
  const tMax = Math.ceil((Math.max(...temps) + 3) / 5) * 5;
  const y = (t: number) => TOP + ((tMax - t) / (tMax - tMin)) * (HEIGHT - TOP - BOTTOM);

  // Wide: the ladder and the schedule side by side in one chart. Narrow: the schedule below the ladder, on the same
  // temperature scale, so neither the labels nor the profile get squeezed (EDT-036).
  const narrow = width < NARROW;
  const lanes = bandLanes();
  const laneCount = Math.max(...Object.values(lanes)) + 1;
  const railX = AXIS + 4;
  const railW = laneCount * LANE;
  const labelX = railX + railW + 14;
  const labelW = 190;
  const plotX = narrow ? AXIS + 6 : labelX + labelW + 10;
  const plotW = Math.max(40, width - plotX - 8);

  const order = restsByTypical();
  const labelY = spreadLabels(
    order.map((id) => y(MASH_RESTS[id].tempTypical)),
    15,
    TOP + 4,
    HEIGHT - BOTTOM - 4,
  );

  const total = Math.max(profile.totalMinutes, 1);
  const x = (minute: number) => plotX + (minute / total) * plotW;
  const tickStep = [5, 10, 15, 30, 60, 120].find((s) => total / s <= Math.max(2, Math.floor(plotW / 60))) ?? 240;
  const xTicks = Array.from({ length: Math.floor(total / tickStep) + 1 }, (_, i) => i * tickStep);
  const yTicks = Array.from({ length: Math.floor((tMax - tMin) / 10) + 1 }, (_, i) => Math.ceil(tMin / 10) * 10 + i * 10).filter((t) => t <= tMax);

  const summary =
    steps.length === 0
      ? "No rests planned yet."
      : `Total mash time ${formatMinutes(profile.totalMinutes)}: ${formatMinutes(profile.holdMinutes)} of rests, ` +
        `${formatMinutes(profile.rampMinutes)} heating at ${rate} °C/min.`;

  const axisLayer = (w: number) => (
    <>
          {/* Temperature axis and grid */}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={AXIS} x2={w - 8} y1={y(t)} y2={y(t)} class="stroke-stone-200 dark:stroke-white/10" />
              <text x={AXIS - 6} y={y(t)} dy="0.32em" text-anchor="end" class="fill-stone-500 text-[10px] dark:fill-stone-400">
                {t}
              </text>
            </g>
          ))}
          <text x={4} y={TOP - 4} class="fill-stone-500 text-[10px] dark:fill-stone-400">
            °C
          </text>

    </>
  );
  const restsLayer = (
    <>
          {/* The rests: bands in lanes, typical temperature ticked, labels beside them */}
          {order.map((id, k) => {
            const info = MASH_RESTS[id];
            const bx = railX + lanes[id] * LANE;
            const ty = y(info.tempTypical);
            const ly = labelY[k];
            const isPlanned = planned.has(id);
            const isSelected = props.selected === id;
            const obsolete = info.flags.includes("obsolete");
            return (
              <g
                key={id}
                data-ladder-rest={id}
                role="button"
                tabIndex={0}
                aria-label={`${info.label}, ${info.range}: about this rest`}
                aria-pressed={isSelected}
                class="cursor-pointer focus:outline-none [&:focus-visible_.ladder-name]:underline"
                onClick={() => props.onSelect(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onSelect(id);
                  }
                }}
              >
                <title>{tooltip(id)}</title>
                <rect
                  x={bx}
                  y={y(info.tempMax)}
                  width={LANE - 2}
                  height={Math.max(2, y(info.tempMin) - y(info.tempMax))}
                  rx={2}
                  class={isPlanned ? "fill-berry dark:fill-berry-light" : "fill-stone-400 dark:fill-stone-500"}
                  opacity={obsolete ? 0.35 : 0.85}
                />
                <line x1={bx - 2} x2={bx + LANE} y1={ty} y2={ty} stroke-width={2} class="stroke-ink dark:stroke-ink-light" />
                <path
                  d={`M ${railX + railW + 2} ${ty} L ${labelX - 4} ${ly}`}
                  fill="none"
                  class="stroke-stone-300 dark:stroke-white/20"
                />
                <text
                  x={labelX}
                  y={ly}
                  dy="0.32em"
                  class={
                    "ladder-name text-[11px] font-semibold " +
                    (isSelected || isPlanned ? "fill-berry dark:fill-berry-light" : obsolete ? "fill-stone-400 dark:fill-stone-500" : "fill-current")
                  }
                >
                  {info.short}
                  {obsolete ? " (obsolete)" : ""}
                  <tspan class="font-normal fill-stone-500 dark:fill-stone-400"> {info.tempTypical} °C</tspan>
                </text>
              </g>
            );
          })}

    </>
  );
  const scheduleLayer = (
    <>
          {/* The schedule */}
          {steps.length === 0 ? (
            <text
              x={plotX + plotW / 2}
              y={(TOP + HEIGHT - BOTTOM) / 2}
              text-anchor="middle"
              class="fill-stone-500 text-[11px] dark:fill-stone-400"
            >
              Tick rests below to draw the schedule.
            </text>
          ) : (
            <g data-ladder-profile>
              {[...planned].map((id) => (
                <rect
                  key={id}
                  x={plotX}
                  width={plotW}
                  y={y(MASH_RESTS[id].tempMax)}
                  height={Math.max(2, y(MASH_RESTS[id].tempMin) - y(MASH_RESTS[id].tempMax))}
                  class="fill-berry-light"
                  opacity={0.14}
                />
              ))}
              <polyline
                points={profile.points.map((p) => `${x(p.minute)},${y(p.temp)}`).join(" ")}
                fill="none"
                stroke-width={2.5}
                stroke-linejoin="round"
                class="stroke-berry dark:stroke-berry-light"
              />
              {profile.segments
                .filter((s) => s.kind === "hold")
                .map((s) => (
                  <line
                    key={`${s.restId}-${s.from.minute}`}
                    x1={x(s.from.minute)}
                    x2={x(s.to.minute)}
                    y1={y(s.from.temp)}
                    y2={y(s.to.temp)}
                    stroke="transparent"
                    stroke-width={12}
                  >
                    <title>{`${MASH_RESTS[s.restId].short}: ${s.from.temp} °C for ${formatMinutes(s.to.minute - s.from.minute)}, from minute ${Math.round(s.from.minute)}`}</title>
                  </line>
                ))}
              {/* Time axis */}
              <line x1={plotX} x2={plotX + plotW} y1={HEIGHT - BOTTOM} y2={HEIGHT - BOTTOM} class="stroke-stone-400 dark:stroke-stone-500" />
              {xTicks.map((m) => (
                <text key={`x${m}`} x={x(m)} y={HEIGHT - BOTTOM + 12} text-anchor="middle" class="fill-stone-500 text-[10px] dark:fill-stone-400">
                  {m}
                </text>
              ))}
              <text x={plotX + plotW} y={HEIGHT - 4} text-anchor="end" class="fill-stone-500 text-[10px] dark:fill-stone-400">
                min
              </text>
            </g>
          )}

    </>
  );
  /** The hard upper limit (EDT-036): a red line, left out where it would cross the labels. */
  const limitLayer = (spans: [number, number][], label: boolean) => (
    <g data-ladder-limit>
      {spans.map(([x1, x2]) => (
        <line
          key={x1}
          x1={x1}
          x2={x2}
          y1={y(MASH_TEMPERATURE_LIMIT)}
          y2={y(MASH_TEMPERATURE_LIMIT)}
          stroke-dasharray="5 3"
          stroke-width={1.5}
          class="stroke-red-500"
        />
      ))}
      {label && (
        <text
          x={width - 10}
          y={y(MASH_TEMPERATURE_LIMIT) - 4}
          text-anchor="end"
          class="fill-red-600 text-[10px] font-semibold dark:fill-red-400"
        >
          max {MASH_TEMPERATURE_LIMIT} °C
        </text>
      )}
    </g>
  );
  const chart = (part: string, children: ComponentChildren) => (
    <svg
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label={`${part}. ${summary}`}
      class="block max-w-full text-ink dark:text-ink-light"
      data-ladder-part={part}
    >
      {children}
    </svg>
  );

  return (
    <div class="mb-4" data-mash-ladder>
      <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <p class="text-sm font-medium text-ink dark:text-ink-light" data-mash-total>
          {summary}
        </p>
        <div class="grid grid-cols-[auto_1fr] items-center gap-x-2">
          <NumberField label="Heating rate" unit="°C/min" value={rateValue} invalid={false} onChange={setRateValue} />
        </div>
      </div>
      <div ref={box} class="mt-2 rounded-lg bg-stone-50 ring-1 ring-line dark:bg-white/5 dark:ring-white/10">
        {narrow ? (
          <>
            {chart(
              "Mash temperature ladder",
              <>
                {axisLayer(width)}
                {restsLayer}
                {limitLayer([[AXIS, labelX - 4]], false)}
              </>,
            )}
            {chart(
              "Mash schedule",
              <>
                {axisLayer(width)}
                {scheduleLayer}
                {limitLayer([[AXIS, width - 8]], true)}
              </>,
            )}
          </>
        ) : (
          chart(
            "Mash temperature ladder and schedule",
            <>
              {axisLayer(width)}
              {restsLayer}
              {scheduleLayer}
              {limitLayer(
                [
                  [AXIS, labelX - 4],
                  [plotX, width - 8],
                ],
                true,
              )}
            </>,
          )
        )}
      </div>
      {warnings.length > 0 && (
        <ul class="mt-2 space-y-0.5 text-xs font-medium text-amber-700 dark:text-brass-light" data-mash-schedule-warnings>
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w.message}</li>
          ))}
        </ul>
      )}
      <p class={`${HINT_STYLE} mt-1`}>
        Click a rest in the ladder for what it does. The profile starts at the first rest's temperature.
      </p>
    </div>
  );
}
