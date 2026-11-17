/**
 * The brew-day curve on the Overview tab (EDT-078, QE-86): the temperature over the brewing time. The mash schedule
 * in berry, as on the Mashing tab; a dashed jump to the boil (heating to the boil is not counted, so it takes no
 * time); the boil at 100 °C in brass with each hop and other addition dropped in at its minute, in its Boil Schedule
 * colour and icon; the whirlpool's swirl after the boil. Behind it the two phases, on a brew-day clock.
 */

import { MASH_IN_INFO, MASH_RESTS, isMashRestId } from "../model";
import { formatMinutes } from "../mashSchedule";
import type { brewDayCurve, CurveAddition } from "../overview";
import { AdditionIcon } from "./AdditionIcon";
import { rowColour } from "./IngredientsTab";
import { useWidth } from "./useWidth";

type Curve = NonNullable<ReturnType<typeof brewDayCurve>>;

const HEIGHT = 230;
/** Room for the phase labels above the plot. */
const TOP = 26;
const BOTTOM = 24;
const LEFT = 42;
/** Room for the whirlpool's swirl after the boil. */
const RIGHT = 28;
const ICON = 18;
/** At most this many icons stacked at one minute; more say "+n". */
const STACK = 3;
const BOIL = 100;

/** A brew-day clock time: "0:00", "1:30". */
const clock = (minute: number) => `${Math.floor(minute / 60)}:${String(Math.round(minute) % 60).padStart(2, "0")}`;

/** The whirlpool: a swirl, as an icon of 16 × 16 at its top left `x`, `y`. */
function Swirl(props: { x: number; y: number }) {
  return (
    <svg x={props.x} y={props.y} width={16} height={16} viewBox="0 0 16 16" aria-hidden="true" data-curve-whirlpool-icon>
      <path
        d="M8 7.2 a0.9 0.9 0 0 1 0.9 0.9 a1.8 1.8 0 0 1 -1.8 1.8 a2.7 2.7 0 0 1 -2.7 -2.7 a3.6 3.6 0 0 1 3.6 -3.6 a4.5 4.5 0 0 1 4.5 4.5 a5.4 5.4 0 0 1 -1.6 3.8"
        fill="none"
        stroke-width={1.6}
        stroke-linecap="round"
        class="stroke-ink dark:stroke-ink-light"
      />
    </svg>
  );
}

export function BrewDayCurve(props: { curve: Curve }) {
  const { curve } = props;
  const { box, width } = useWidth();
  const plotW = Math.max(120, width - LEFT - RIGHT);
  const span = Math.max(1, curve.total);
  const x = (minute: number) => LEFT + (minute / span) * plotW;
  // Additions at the same minute are stacked: the plot leaves room above the boil for the highest stack.
  const stacks = new Map<number, CurveAddition[]>();
  for (const a of curve.boil?.additions ?? []) {
    stacks.set(a.minute, [...(stacks.get(a.minute) ?? []), a]);
  }
  const highest = Math.min(STACK, Math.max(0, ...[...stacks.values()].map((s) => s.length)));
  const iconRoom = highest * ICON + 6;
  const temps = curve.mash?.points.map((p) => p.temp) ?? [];
  const low = Math.max(0, Math.floor((Math.min(BOIL - 40, ...temps) - 5) / 10) * 10);
  const top = TOP + iconRoom;
  const bottom = HEIGHT - BOTTOM;
  const y = (temp: number) => top + ((BOIL - temp) / (BOIL - low)) * (bottom - top);
  const yTicks = [low, ...[20, 40, 60, 80].filter((t) => t > low + 8), BOIL];
  const step = [15, 30, 60, 120, 180].find((s) => span / s <= Math.max(2, Math.floor(plotW / 56))) ?? 240;
  const xTicks = Array.from({ length: Math.floor(span / step) + 1 }, (_, k) => k * step);
  const mashEnd = curve.mash?.minutes ?? 0;
  const boilStart = curve.boil?.start ?? mashEnd;
  const boilEnd = boilStart + (curve.boil?.minutes ?? 0);
  /** A phase's label, as much of it as fits its band. */
  const phaseLabel = (from: number, to: number, name: string, time: string, cls: string, data: string) => {
    const w = x(to) - x(from);
    const full = `${name} · ${time}`;
    const text = w >= full.length * 6.2 + 8 ? full : w >= name.length * 6.2 + 8 ? name : undefined;
    return text ? (
      <text x={x(from) + 4} y={TOP - 9} class={`text-[11px] font-semibold ${cls}`} data-curve-phase={data}>
        {text}
      </text>
    ) : null;
  };
  const restName = (id: string) => (isMashRestId(id) ? MASH_RESTS[id].short : id === "MashIn" ? MASH_IN_INFO.label : id);
  const summary =
    [
      curve.mash && `mashing ${formatMinutes(curve.mash.minutes)} in ${curve.mash.holds.length} rests`,
      curve.boil && `boil ${curve.boil.minutes} min with ${curve.boil.additions.length} additions`,
      curve.whirlpool && "then the whirlpool",
    ]
      .filter(Boolean)
      .join(", ") + ".";
  return (
    <div ref={box} class="mb-3" data-brew-day-curve>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Brew day: ${summary}`}
        class="block max-w-full text-ink dark:text-ink-light"
      >
        {/* The two phases behind the curve. */}
        {curve.mash && (
          <rect x={x(0)} y={TOP - 22} width={x(mashEnd) - x(0)} height={bottom - TOP + 22} rx={4} class="fill-berry-light" opacity={0.1} data-curve-band="mash" />
        )}
        {curve.boil && (
          <rect
            x={x(boilStart)}
            y={TOP - 22}
            width={Math.max(2, x(boilEnd) - x(boilStart))}
            height={bottom - TOP + 22}
            rx={4}
            class="fill-brass-light"
            opacity={0.16}
            data-curve-band="boil"
          />
        )}
        {curve.mash && phaseLabel(0, mashEnd, "Mashing", formatMinutes(mashEnd), "fill-berry dark:fill-berry-light", "mash")}
        {curve.boil && phaseLabel(boilStart, boilEnd, "Boil", `${curve.boil.minutes} min`, "fill-brass dark:fill-brass-light", "boil")}
        {/* Temperature grid. */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} class="stroke-stone-200 dark:stroke-white/10" stroke-dasharray={t === BOIL ? undefined : "2 3"} />
            <text x={LEFT - 6} y={y(t)} dy="0.32em" text-anchor="end" class="fill-stone-500 text-[10px] tabular-nums dark:fill-stone-400">
              {t} °C
            </text>
          </g>
        ))}
        {/* The mash schedule, its rests named where they fit. */}
        {curve.mash && (
          <g data-curve-mash>
            <polyline
              points={curve.mash.points.map((p) => `${x(p.minute)},${y(p.temp)}`).join(" ")}
              fill="none"
              stroke-width={2.5}
              stroke-linejoin="round"
              stroke-linecap="round"
              class="stroke-berry dark:stroke-berry-light"
            />
            {curve.mash.holds.map((h) => {
              const w = x(h.to) - x(h.from);
              const name = restName(h.restId);
              const cx = (x(h.from) + x(h.to)) / 2;
              return (
                <g key={`${h.restId}-${h.from}`} data-curve-rest={h.restId}>
                  <title>{`${name}: ${h.temp} °C for ${formatMinutes(h.to - h.from)}, from ${clock(h.from)}`}</title>
                  <line x1={x(h.from)} x2={x(h.to)} y1={y(h.temp)} y2={y(h.temp)} stroke="transparent" stroke-width={14} />
                  {w >= 30 && (
                    <text x={cx} y={y(h.temp) - 6} text-anchor="middle" class="fill-current text-[10px] font-semibold tabular-nums">
                      {h.temp}°
                    </text>
                  )}
                  {w >= name.length * 5.6 + 6 && (
                    <text x={cx} y={y(h.temp) + 13} text-anchor="middle" class="fill-stone-500 text-[10px] dark:fill-stone-400">
                      {name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
        {/* Heating to the boil takes no time here: a dashed jump. */}
        {curve.mash && curve.boil && (
          <line
            x1={x(boilStart)}
            x2={x(boilStart)}
            y1={y(curve.mash.points[curve.mash.points.length - 1].temp)}
            y2={y(BOIL)}
            stroke-dasharray="3 3"
            stroke-width={1.5}
            class="stroke-brass dark:stroke-brass-light"
            data-curve-jump
          >
            <title>Heating to the boil (not counted)</title>
          </line>
        )}
        {/* The boil with its additions. */}
        {curve.boil && (
          <g data-curve-boil>
            <line
              x1={x(boilStart)}
              x2={Math.max(x(boilEnd), x(boilStart) + 2)}
              y1={y(BOIL)}
              y2={y(BOIL)}
              stroke-width={3}
              stroke-linecap="round"
              class="stroke-brass dark:stroke-brass-light"
            />
            {[...stacks.entries()].map(([minute, stack]) =>
              stack.slice(0, STACK).map((a, k) => (
                <g key={`${minute}-${k}`} data-curve-addition={a.kind === "hops" ? "hop" : "other"}>
                  <title>{`${a.name}: ${a.grams} g at ${clock(a.minute)}, cooks ${a.cooking} min`}</title>
                  {k === STACK - 1 && stack.length > STACK ? (
                    <text x={x(minute)} y={y(BOIL) - 5 - k * ICON} text-anchor="middle" class="fill-current text-[10px] font-semibold">
                      +{stack.length - STACK + 1}
                    </text>
                  ) : (
                    <AdditionIcon kind={a.kind} colour={rowColour(a.kind, a.row)} size={ICON} x={x(minute) - ICON / 2} y={y(BOIL) - ICON - 3 - k * ICON} />
                  )}
                </g>
              )),
            )}
          </g>
        )}
        {curve.whirlpool && curve.boil && (
          <g data-curve-whirlpool>
            <title>Whirlpool after the boil</title>
            <Swirl x={x(boilEnd) + 6} y={y(BOIL) - 8} />
          </g>
        )}
        {/* The brew-day clock. */}
        <line x1={LEFT} x2={LEFT + plotW} y1={bottom} y2={bottom} class="stroke-stone-400 dark:stroke-stone-500" />
        {xTicks.map((m) => (
          <text key={`x${m}`} x={x(m)} y={bottom + 14} text-anchor={m === 0 ? "start" : "middle"} class="fill-stone-500 text-[10px] tabular-nums dark:fill-stone-400">
            {clock(m)}
          </text>
        ))}
      </svg>
    </div>
  );
}
