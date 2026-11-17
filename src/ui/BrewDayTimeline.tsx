/**
 * The brew-day timeline on the Overview tab (EDT-078, QE-87): the brewing time as one bar of time, left to right. The
 * mash's heating (striped) and rests (solid berry, with their temperature and name where they fit), a divider for the
 * jump to the boil (heating to the boil is not counted, so it takes no time), the boil in brass; above the bar one
 * icon at each minute something goes into the boil, in its Boil Schedule colour (QE-89), with all that goes in then in
 * its tooltip. Below it a brew-day clock (h:mm) and a legend.
 */

import type { ComponentChildren } from "preact";
import { MASH_IN_INFO, MASH_RESTS, isMashRestId } from "../model";
import { formatMinutes } from "../mashSchedule";
import type { BrewDayTimeline as Timeline, TimelineAddition, TimelineSegment } from "../overview";
import { AdditionIcon } from "./AdditionIcon";
import { rowColour } from "./IngredientsTab";
import { useWidth } from "./useWidth";

const ICON = 18;
/** About how wide a character of the bar's 11 px labels is, in px. */
const CHAR = 6.2;

/** A brew-day clock time: "0:00", "1:30". */
export const clock = (minute: number) => `${Math.floor(minute / 60)}:${String(Math.round(minute) % 60).padStart(2, "0")}`;

/** The heating's stripes over the rest colour, light and dark. */
const STRIPES = { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, rgb(255 255 255 / 0.45) 4px 7px)" };

const restName = (id: string) => (isMashRestId(id) ? MASH_RESTS[id].short : id === "MashIn" ? MASH_IN_INFO.label : id);

/** One entry of the legend: its swatch or icon, and what it means. */
function Key(props: { swatch: ComponentChildren; label: string }) {
  return (
    <span class="inline-flex items-center gap-1.5" data-timeline-key>
      {props.swatch}
      {props.label}
    </span>
  );
}

export function BrewDayTimeline(props: { timeline: Timeline }) {
  const { timeline } = props;
  const { box, width } = useWidth();
  const barW = Math.max(120, width);
  const span = Math.max(1, timeline.total);
  const pct = (minute: number) => `${(minute / span) * 100}%`;
  const px = (minutes: number) => (minutes / span) * barW;
  const mashEnd = timeline.mash?.minutes ?? 0;
  const boil = timeline.boil;
  // What goes in at the same minute shares one icon (QE-89): a hop's while a hop is among it, in the first one's colour.
  const atMinute = new Map<number, TimelineAddition[]>();
  for (const a of boil?.additions ?? []) {
    atMinute.set(a.minute, [...(atMinute.get(a.minute) ?? []), a]);
  }
  /** The longest of these texts that fits `minutes` of the bar, or none. */
  const fit = (minutes: number, ...texts: string[]) => texts.find((t) => t.length * CHAR + 10 <= px(minutes));
  const step = [15, 30, 60, 120, 180].find((s) => span / s <= Math.max(2, Math.floor(barW / 56))) ?? 240;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, k) => k * step);
  const showEnd = px(span - ticks[ticks.length - 1]) >= 40;
  const segmentTitle = (s: TimelineSegment) =>
    s.kind === "heat"
      ? `Heating from ${s.fromTemp} °C to ${s.temp} °C: ${formatMinutes(s.to - s.from)}, from ${clock(s.from)}`
      : `${restName(s.restId)}: ${s.temp} °C for ${formatMinutes(s.to - s.from)}, from ${clock(s.from)}`;
  const phase = (from: number, to: number, name: string, time: string, cls: string, data: string) => {
    const text = fit(to - from, `${name} · ${time}`, name);
    return (
      text && (
        <span
          class={`absolute bottom-0 truncate text-[11px] font-semibold ${cls}`}
          style={{ left: pct(from), width: pct(to - from) }}
          data-timeline-phase={data}
        >
          {text}
        </span>
      )
    );
  };
  const summary =
    [
      timeline.mash && `mashing ${formatMinutes(timeline.mash.minutes)} in ${timeline.mash.segments.filter((s) => s.kind === "rest").length} rests`,
      boil && `boil ${boil.minutes} min with ${boil.additions.length} additions`,
    ]
      .filter(Boolean)
      .join(", ") + ".";
  // The icon shown at each minute, and so the kinds the legend explains.
  const shownAt = (all: TimelineAddition[]) => all.find((a) => a.kind === "hops") ?? all[0];
  const kinds = new Set([...atMinute.values()].map((all) => shownAt(all).kind));
  return (
    <div ref={box} class="mb-3" data-brew-day-timeline>
      <div>
        {/* The phases, over their part of the bar. */}
        <div class="relative h-4" aria-hidden="true">
          {timeline.mash && phase(0, mashEnd, "Mashing", formatMinutes(mashEnd), "text-berry dark:text-berry-light", "mash")}
          {boil && phase(boil.start, boil.start + boil.minutes, "Boil", `${boil.minutes} min`, "text-brass dark:text-brass-light", "boil")}
        </div>
        {/* The boil additions: one icon at each minute something goes in. */}
        {atMinute.size > 0 && (
          <div class="relative" style={{ height: `${ICON + 2}px` }}>
            {[...atMinute.entries()].map(([minute, all]) => {
              const shown = shownAt(all);
              return (
                <span
                  key={minute}
                  class="absolute bottom-0 flex -translate-x-1/2 justify-center"
                  style={{ left: pct(minute), width: `${ICON}px` }}
                  title={all.map((a) => `${a.name}: ${a.grams} g at ${clock(a.minute)}, cooks ${a.cooking} min`).join("\n")}
                  data-timeline-addition={shown.kind === "hops" ? "hop" : "other"}
                >
                  <AdditionIcon kind={shown.kind} colour={rowColour(shown.kind, shown.row)} size={ICON} />
                </span>
              );
            })}
          </div>
        )}
        {/* The bar. */}
        <div class="relative mt-0.5">
          <div
            class="relative h-9 overflow-hidden rounded-md bg-stone-100 ring-1 ring-line dark:bg-white/5 dark:ring-white/10"
            role="img"
            aria-label={`Brew day: ${summary}`}
            data-timeline-bar
          >
            {timeline.mash?.segments.map((s) => {
              const rest = s.kind === "rest";
              const text = rest ? fit(s.to - s.from, `${restName(s.restId)} ${s.temp}°`, `${s.temp}°`) : undefined;
              return (
                <div
                  key={`${s.kind}-${s.from}`}
                  class={
                    "absolute inset-y-0 flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-semibold " +
                    (rest ? "bg-berry text-white dark:bg-berry-light dark:text-ink" : "bg-berry-light/60 dark:bg-berry/70")
                  }
                  style={{ left: pct(s.from), width: pct(s.to - s.from), ...(rest ? {} : STRIPES) }}
                  title={segmentTitle(s)}
                  data-timeline-segment={s.kind}
                  data-timeline-rest={s.restId}
                >
                  {text}
                </div>
              );
            })}
            {boil && (
              <div
                class="absolute inset-y-0 flex items-center justify-center overflow-hidden whitespace-nowrap bg-brass text-[11px] font-semibold text-ink dark:bg-brass-light"
                style={{ left: pct(boil.start), width: pct(Math.max(boil.minutes, span / 200)) }}
                title={`Boil at 100 °C for ${boil.minutes} min, from ${clock(boil.start)}`}
                data-timeline-segment="boil"
              >
                {fit(boil.minutes, "Boil 100 °C", "Boil", "100°")}
              </div>
            )}
            {/* Each addition's minute, as a notch through the boil. */}
            {[...atMinute.keys()].map((minute) => (
              <span key={`n${minute}`} class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/80 dark:bg-surface-dark/80" style={{ left: pct(minute) }} />
            ))}
            {/* Heating to the boil takes no time here: a divider. */}
            {timeline.mash && boil && (
              <span
                class="absolute -inset-y-px w-1 -translate-x-1/2 bg-white dark:bg-surface-dark"
                style={{ left: pct(boil.start) }}
                title="Heating to the boil (not counted)"
                data-timeline-jump
              />
            )}
          </div>
        </div>
        {/* The brew-day clock. */}
        <div class="relative h-4 text-[10px] text-stone-500 tabular-nums dark:text-stone-400" aria-hidden="true" data-timeline-axis>
          {ticks.map((m) => (
            <span key={m} class={`absolute top-0.5 ${m === 0 ? "" : "-translate-x-1/2"}`} style={{ left: pct(m) }}>
              {clock(m)}
            </span>
          ))}
          {showEnd && (
            <span class="absolute top-0.5 right-0 font-semibold text-ink dark:text-ink-light" data-timeline-end>
              {clock(span)}
            </span>
          )}
        </div>
      </div>
      {/* The legend. */}
      <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-300" data-timeline-legend>
        {timeline.mash && (
          <>
            <Key swatch={<span class="h-3 w-5 rounded-sm bg-berry-light/60 dark:bg-berry/70" style={STRIPES} />} label="Heating" />
            <Key swatch={<span class="h-3 w-5 rounded-sm bg-berry dark:bg-berry-light" />} label="Rest" />
          </>
        )}
        {boil && <Key swatch={<span class="h-3 w-5 rounded-sm bg-brass dark:bg-brass-light" />} label="Boil" />}
        {kinds.has("hops") && <Key swatch={<AdditionIcon kind="hops" colour="var(--hop-1)" size={14} />} label="Hop" />}
        {kinds.has("others") && <Key swatch={<AdditionIcon kind="others" colour="var(--addition-1)" size={14} />} label="Other addition" />}
      </div>
    </div>
  );
}
