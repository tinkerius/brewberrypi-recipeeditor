/**
 * The Malt and Hops tabs (EDT-041..050, QE-34, QE-35): the malts or the hops of the brew as a table the brewer adds
 * rows to and sorts, a donut of each row's share of the total weight, and a figure computed from the table and the
 * batch: the beer colour (EBC) for the malts, the bitterness (IBU) for the hops. Shares and figures are computed,
 * never stored (app RCP-013).
 */

import { Fragment, type ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Problem } from "../validate";
import { balanceOf, beerColourHex, buGu } from "../brewMath";
import {
  INGREDIENT_LABELS,
  batchOf,
  beerColourOf,
  bitternessOf,
  formatShare,
  ingredientsOf,
  shareOf,
  totalGrams,
  validBoilMinutes,
  validGrams,
  validEbc,
  validLiters,
  validPlato,
  withIngredients,
  type Figure,
  type Ingredient,
  type IngredientKind,
  type Recipe,
} from "../model";
import { ADD_ROW_LINE, AddRowButton } from "./AddRow";
import { DragHandle, DropLine } from "./DragHandle";
import { NumberField, TextField } from "./fields";
import { moveItem } from "./reorder";
import { BalanceScale, BeerColourScale, BitternessScale } from "./StyleScale";
import { BUTTON_STYLES, HINT_STYLE, LINK_STYLE, SECTION_TITLE_STYLE } from "./styles";
import { useReorder } from "./useReorder";
import { useWidth } from "./useWidth";

const CELL = "px-1 py-2 align-middle first:pl-2 last:pr-2 sm:px-2 sm:first:pl-3 sm:last:pr-3";
const HEAD = `${CELL} text-[11px] font-semibold text-stone-600 sm:text-xs dark:text-stone-300`;
const NUMBER = "whitespace-nowrap text-right tabular-nums";

/** The chart colours in their fixed order (EDT-047); rows from the 9th on share "other". */
const SERIES = 8;
export const seriesColour = (i: number) => (i < SERIES ? `var(--series-${i + 1})` : "var(--series-other)");

/** A number field of a row (EDT-042): the grams, a malt's EBC, a hop's alpha acid and boil time. */
type Column = { field: "grams" | "ebc" | "alpha" | "minutes"; head: string; label: string; integer: boolean; width: string };
const COLUMNS: Record<IngredientKind, Column[]> = {
  malts: [
    { field: "grams", head: "g", label: "Amount (g)", integer: true, width: "w-16 sm:w-28" },
    { field: "ebc", head: "EBC", label: "Colour (EBC)", integer: false, width: "w-24 sm:w-28" },
  ],
  hops: [
    { field: "grams", head: "g", label: "Amount (g)", integer: true, width: "w-12 sm:w-24" },
    { field: "alpha", head: "α %", label: "Alpha acid (%)", integer: false, width: "w-12 sm:w-20" },
    { field: "minutes", head: "min", label: "Boil time (min)", integer: true, width: "w-12 sm:w-20" },
  ],
};

/** Each row's share of the total weight as a donut, with a legend (EDT-047). */
function ShareDonut(props: { kind: IngredientKind; list: Ingredient[] }) {
  const { list } = props;
  const total = totalGrams(list);
  const { one } = INGREDIENT_LABELS[props.kind];
  const slices = list
    .map((entry, i) => ({ entry, i, share: shareOf(entry, list) }))
    .filter((s): s is { entry: Ingredient; i: number; share: number } => s.share !== undefined);
  if (slices.length === 0) {
    return null;
  }
  const size = 132;
  const r = 52;
  const width = 22;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const name = (entry: Ingredient, i: number) => (typeof entry.name === "string" && entry.name ? entry.name : `${one} ${i + 1}`);
  return (
    <figure class="flex flex-wrap items-center gap-x-6 gap-y-3" data-share-chart={props.kind}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Shares of the total weight: ${slices.map((s) => `${name(s.entry, s.i)} ${formatShare(s.share)}`).join(", ")}`}
        class="shrink-0 -rotate-90"
      >
        {slices.map((s) => {
          const length = (s.share / 100) * circumference;
          // A 2px gap of the surface between slices; none for a single slice (a full ring).
          const gap = slices.length > 1 ? Math.min(2, length / 2) : 0;
          const dash = `${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`;
          const circle = (
            <circle
              key={s.i}
              data-share-slice={s.i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seriesColour(s.i)}
              stroke-width={width}
              stroke-dasharray={dash}
              stroke-dashoffset={-offset}
              class="transition-opacity hover:opacity-80"
            >
              <title>{`${name(s.entry, s.i)}: ${s.entry.grams} g, ${formatShare(s.share)}`}</title>
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
        >
          {total} g
        </text>
      </svg>
      <figcaption>
        <ul class="space-y-1 text-sm" data-share-legend>
          {slices.map((s) => (
            <li key={s.i} class="flex items-center gap-2">
              <span aria-hidden="true" class="size-3 shrink-0 rounded-sm" style={{ background: seriesColour(s.i) }} />
              <span class="text-ink dark:text-ink-light">{name(s.entry, s.i)}</span>
              <span class="tabular-nums text-stone-500 dark:text-stone-400">{formatShare(s.share)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** A link to the Water tab, where the knockout volume is entered (EDT-050). */
function WaterLink(props: { onWater?: () => void }) {
  return props.onWater ? (
    <button type="button" class={LINK_STYLE} data-water-link onClick={props.onWater}>
      Water tab
    </button>
  ) : (
    <>Water tab</>
  );
}

/** Why a figure can't be computed yet (EDT-048, EDT-049), as a hint: what to enter, and where. */
function missingText(kind: IngredientKind, figure: Figure, onWater?: () => void): ComponentChildren {
  const { one } = INGREDIENT_LABELS[kind];
  if (figure.noEntries) {
    return kind === "malts" ? "Add malts with their amounts." : "Add hops with their amounts.";
  }
  const needs: ComponentChildren[] = [];
  if (figure.rows && figure.rows.length > 0) {
    const what = kind === "malts" ? "the EBC" : "the alpha acid and boil time";
    const rows = figure.rows.length === 1 ? `${one.toLowerCase()} ${figure.rows[0]}` : `${one.toLowerCase()}s ${figure.rows.join(", ")}`;
    needs.push(`${what} of ${rows}`);
  }
  // The knockout volume and the original gravity are entered on the Water tab (EDT-050).
  const onWaterTab = (figure.batch ?? []).map((f) => (f === "liters" ? "the knockout volume" : "the original gravity"));
  if (onWaterTab.length > 0) {
    needs.push(
      <>
        {onWaterTab.join(" and ")} on the <WaterLink onWater={onWater} />
      </>,
    );
  }
  return (
    <>
      Enter{" "}
      {needs.map((n, k) => (
        <Fragment key={k}>
          {k > 0 && " and "}
          {n}
        </Fragment>
      ))}
      .
    </>
  );
}

/**
 * The computed figure next to the donut (EDT-048, EDT-049): the beer colour with its swatch and its place among
 * common beers (EDT-055), or the bitterness; the knockout volume comes from the Water tab.
 */
function FigureLine(props: { kind: IngredientKind; recipe: Recipe; onWater?: () => void }) {
  const malts = props.kind === "malts";
  const figure = malts ? beerColourOf(props.recipe) : bitternessOf(props.recipe);
  const label = malts ? "Beer colour" : "Bitterness";
  const { liters, plato } = batchOf(props.recipe);
  const knockout = (
    <>
      the knockout volume ({validLiters(liters) ? `${liters} L, ` : ""}
      <WaterLink onWater={props.onWater} />)
    </>
  );
  const gravity = (
    <>
      the original gravity ({validPlato(plato) ? `${plato} °P, ` : ""}
      <WaterLink onWater={props.onWater} />)
    </>
  );
  const ratio = !malts && figure.value !== undefined && validPlato(plato) && plato > 0 ? buGu(figure.value, plato) : undefined;
  return (
    <div data-figure={props.kind}>
      <p class="flex items-center gap-2 text-sm font-medium text-ink dark:text-ink-light">
        {label}:
        {figure.value === undefined ? (
          <span data-figure-value>–</span>
        ) : malts ? (
          <>
            <span
              aria-hidden="true"
              data-beer-swatch
              class="inline-block h-5 w-8 rounded ring-1 ring-black/10 dark:ring-white/20"
              style={{ background: beerColourHex(figure.value) }}
            />
            <span data-figure-value class="text-base font-semibold tabular-nums">
              {Math.round(figure.value)} EBC
            </span>
          </>
        ) : (
          <span data-figure-value class="text-base font-semibold tabular-nums">
            {Math.round(figure.value)} IBU
          </span>
        )}
      </p>
      {malts && figure.value !== undefined && <BeerColourScale ebc={figure.value} />}
      {!malts && figure.value !== undefined && <BitternessScale ibu={figure.value} />}
      {ratio !== undefined && (
        <div class="mt-3">
          <p class="text-xs text-stone-600 dark:text-stone-300" data-bu-gu>
            BU:GU {ratio.toFixed(2)}: {balanceOf(ratio)} (bitterness against the original gravity).
          </p>
          <BalanceScale ratio={ratio} />
        </div>
      )}
      <p class={`${HINT_STYLE} mt-1`} data-figure-hint>
        {figure.value === undefined ? (
          missingText(props.kind, figure, props.onWater)
        ) : malts ? (
          <>Morey's formula, from each malt's EBC and {knockout}.</>
        ) : (
          <>
            Tinseth's formula, from each hop's alpha acid and boil time, {knockout} and {gravity}.
          </>
        )}
      </p>
    </div>
  );
}

function IngredientTable(props: { kind: IngredientKind; recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const { kind } = props;
  const { one } = INGREDIENT_LABELS[kind];
  const columns = COLUMNS[kind];
  const span = columns.length + 4;
  const list = ingredientsOf(props.recipe, kind);
  const total = totalGrams(list);
  const set = (next: Ingredient[]) => props.onChange(withIngredients(props.recipe, kind, next));
  const setField = (i: number, field: string, value: unknown) =>
    set(list.map((e, j) => (j === i ? withField(e, field, value) : e)));
  const invalid = (i: number, field: string) => props.problems.some((p) => p.path === `ingredients.${kind}[${i}].${field}`);
  // Drag and drop with the handle, or the arrow keys on it (EDT-046), like the goals.
  const reorder = useReorder<HTMLTableSectionElement>(list.length, (from, to) => set(moveItem(list, from, to)));
  const body = reorder.container;
  // A new row's name field gets the focus (EDT-042).
  const [focusRow, setFocusRow] = useState<number>();
  useEffect(() => {
    if (focusRow !== undefined) {
      body.current?.querySelectorAll<HTMLInputElement>("[data-ingredient-name] input")[focusRow]?.focus();
      setFocusRow(undefined);
    }
  }, [focusRow]);
  return (
    <div class="relative overflow-x-auto rounded-lg ring-1 ring-line dark:ring-white/10" data-ingredients={kind}>
      <table aria-label={INGREDIENT_LABELS[kind].title} class="w-full border-collapse text-sm">
        <thead class="bg-stone-50 dark:bg-white/5">
          <tr>
            <th class={`${HEAD} w-8`}>
              <span class="sr-only">Move</span>
            </th>
            <th class={`${HEAD} text-left`}>Name</th>
            {columns.map((c) => (
              <th key={c.field} class={`${HEAD} ${c.width} whitespace-nowrap text-right`} title={c.label}>
                {c.head}
              </th>
            ))}
            <th class={`${HEAD} w-12 text-right sm:w-20`}>%</th>
            <th class={`${HEAD} w-10`}>
              <span class="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody ref={body}>
          {list.map((entry, i) => {
            const share = shareOf(entry, list);
            return (
              <tr
                key={i}
                class={
                  "relative border-t border-line dark:border-white/10 " +
                  (reorder.dragging(i) ? "bg-berry/10 opacity-60 dark:bg-berry-light/10" : "")
                }
                data-ingredient={i}
              >
                <td class={`${CELL} pr-0!`}>
                  {reorder.dropLine(i) && <DropLine at={reorder.dropLine(i)!} />}
                  <DragHandle
                    label={`Move ${one.toLowerCase()} ${i + 1}`}
                    title={`Drag to move the ${one.toLowerCase()} (or use the arrow keys)`}
                    count={list.length}
                    onDragStart={(e) => reorder.startDrag(i, e)}
                    onMoveKey={(delta) => reorder.moveKey(i, delta)}
                  />
                </td>
                <td class={`${CELL} min-w-32 sm:min-w-0 [&_input]:px-2! sm:[&_input]:px-3!`} data-ingredient-name>
                  <TextField
                    label={`Name, ${one} ${i + 1}`}
                    compact
                    value={entry.name}
                    invalid={invalid(i, "name")}
                    onChange={(name) => setField(i, "name", name)}
                  />
                </td>
                {columns.map((c) => (
                  <td
                    key={c.field}
                    class={`${CELL} ${c.field === "ebc" ? "min-w-22" : "min-w-14"} sm:min-w-0 [&_input]:w-full! [&_input]:px-1.5! sm:[&_input]:px-3! [&_span]:justify-end`}
                    data-ingredient-field={c.field}
                  >
                    <div class="flex items-center gap-1.5">
                      {/* A malt's own colour, from its EBC (EDT-058). */}
                      {c.field === "ebc" && (
                        <span
                          aria-hidden="true"
                          data-malt-swatch
                          title={validEbc(entry.ebc) ? `About the colour of ${entry.ebc} EBC` : undefined}
                          class={
                            "size-4 shrink-0 rounded-sm ring-1 ring-black/10 dark:ring-white/20 " +
                            (validEbc(entry.ebc) ? "" : "invisible")
                          }
                          style={validEbc(entry.ebc) ? { background: beerColourHex(entry.ebc) } : undefined}
                        />
                      )}
                      <NumberField
                        label={`${c.label}, ${one} ${i + 1}`}
                        compact
                        integer={c.integer}
                        value={entry[c.field]}
                        invalid={invalid(i, c.field)}
                        onChange={(v) => setField(i, c.field, v)}
                      />
                    </div>
                  </td>
                ))}
                <td class={`${CELL} ${NUMBER} text-stone-600 dark:text-stone-300`} data-ingredient-share>
                  <span class="inline-flex items-center justify-end gap-1.5">
                    {share !== undefined && (
                      // On a phone the legend carries the colours, so the columns fit.
                      <span aria-hidden="true" class="hidden size-2.5 rounded-sm sm:inline-block" style={{ background: seriesColour(i) }} />
                    )}
                    {share === undefined ? "–" : formatShare(share)}
                  </span>
                </td>
                <td class={`${CELL} text-right`}>
                  <button
                    type="button"
                    class={BUTTON_STYLES.small}
                    title={`Remove ${one.toLowerCase()}`}
                    aria-label={`Remove ${one.toLowerCase()} ${i + 1}`}
                    onClick={() => set(list.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr class="border-t border-line dark:border-white/10">
              <td colSpan={span} class={`${CELL} ${HINT_STYLE}`}>
                No {one.toLowerCase()} yet.
              </td>
            </tr>
          )}
          <tr class={ADD_ROW_LINE}>
            <td colSpan={span} class="p-0">
              <AddRowButton
                label={`Add ${one.toLowerCase()}`}
                onClick={() => {
                  set([...list, { name: "" }]);
                  setFocusRow(list.length);
                }}
              />
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t-2 border-line font-semibold text-ink dark:border-white/20 dark:text-ink-light">
          <tr data-ingredient-total>
            <td class={CELL} />
            <td class={CELL}>Total</td>
            <td class={`${CELL} ${NUMBER}`}>{total} g</td>
            {columns.slice(1).map((c) => (
              <td key={c.field} class={CELL} />
            ))}
            <td class={`${CELL} ${NUMBER}`}>{total > 0 ? "100 %" : ""}</td>
            <td class={CELL} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** "60 min" before the end of the boil, or "flame-out" for 0 (EDT-054). */
export function additionTime(minutes: number): string {
  return minutes === 0 ? "flame-out" : `${minutes} min`;
}

/**
 * The hop schedule (EDT-054): the hops with an amount and a boil time, longest boil first, as a timeline over the boil
 * (from its start at the left to its end, flame-out, at the right), one dot per hop in its donut colour, and as a
 * list. Hops without a boil time are named in a hint.
 */
function HopSchedule(props: { list: Ingredient[] }) {
  const { box, width } = useWidth();
  const name = (entry: Ingredient, i: number) => (typeof entry.name === "string" && entry.name ? entry.name : `Hop ${i + 1}`);
  const withAmount = props.list.map((h, i) => ({ h, i })).filter(({ h }) => validGrams(h.grams));
  const timed = withAmount
    .filter(({ h }) => validBoilMinutes(h.minutes))
    .sort((a, b) => (b.h.minutes as number) - (a.h.minutes as number) || a.i - b.i);
  const untimed = withAmount.filter(({ h }) => !validBoilMinutes(h.minutes)).map(({ i }) => i + 1);
  const missing =
    untimed.length === 0 ? null : (
      <p class={`${HINT_STYLE} mt-2`} data-schedule-missing>
        No boil time yet: {untimed.length === 1 ? `hop ${untimed[0]}` : `hops ${untimed.join(", ")}`}.
      </p>
    );
  // The outer box is always there, so its width is measured from the start (also while there is no chart yet).
  if (timed.length === 0) {
    return (
      <div ref={box} data-hop-schedule>
        <p class={HINT_STYLE}>Enter the hops' amounts and boil times to see when each goes into the boil.</p>
        {missing}
      </div>
    );
  }
  const boil = Math.max(1, ...timed.map(({ h }) => h.minutes as number));
  const ROW = 26;
  const LABEL = 76;
  const top = 8;
  const axisY = top + timed.length * ROW + 4;
  const height = axisY + 30;
  const x0 = LABEL;
  const x1 = width - 12;
  const x = (minutesBeforeEnd: number) => x0 + ((boil - minutesBeforeEnd) / boil) * (x1 - x0);
  const step = [5, 10, 15, 30, 60].find((s) => boil / s <= Math.max(2, Math.floor((x1 - x0) / 70))) ?? 120;
  const ticks = Array.from({ length: Math.floor(boil / step) + 1 }, (_, k) => boil - k * step).filter((m) => m >= 0);
  if (!ticks.includes(0)) {
    ticks.push(0);
  }
  return (
    <div ref={box} data-hop-schedule>
      <div class="rounded-lg bg-stone-50 ring-1 ring-line dark:bg-white/5 dark:ring-white/10">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Hop schedule over a ${boil}-minute boil: ${timed
            .map(({ h, i }) => `${name(h, i)} ${h.grams} g at ${additionTime(h.minutes as number)}`)
            .join(", ")}`}
          class="block max-w-full text-ink dark:text-ink-light"
        >
          {ticks.map((m) => (
            <g key={m}>
              <line x1={x(m)} x2={x(m)} y1={top} y2={axisY} class="stroke-stone-200 dark:stroke-white/10" />
              <text x={x(m)} y={axisY + 14} text-anchor="middle" class="fill-stone-500 text-[10px] dark:fill-stone-400">
                {m === 0 ? "end" : m}
              </text>
            </g>
          ))}
          <line x1={x0} x2={x1} y1={axisY} y2={axisY} class="stroke-stone-400 dark:stroke-stone-500" />
          <text x={x1} y={axisY + 26} text-anchor="end" class="fill-stone-500 text-[10px] dark:fill-stone-400">
            min before the end of the boil
          </text>
          {timed.map(({ h, i }, row) => {
            const y = top + row * ROW + ROW / 2;
            return (
              <g key={i} data-schedule-hop={i}>
                <title>{`${name(h, i)}: ${h.grams} g, ${additionTime(h.minutes as number)}${h.minutes ? " before the end of the boil" : ""}`}</title>
                <text x={8} y={y} dy="0.32em" class="fill-stone-600 text-[11px] tabular-nums dark:fill-stone-300">
                  {additionTime(h.minutes as number)}
                </text>
                {/* How long it boils: from its addition to the end of the boil. */}
                <line x1={x(h.minutes as number)} x2={x(0)} y1={y} y2={y} stroke={seriesColour(i)} stroke-width={2} stroke-linecap="round" opacity={0.45} />
                <circle cx={x(h.minutes as number)} cy={y} r={6} fill={seriesColour(i)} class="stroke-white stroke-2 dark:stroke-surface-dark" />
              </g>
            );
          })}
        </svg>
      </div>
      <ol class="mt-3 divide-y divide-line rounded-lg text-sm ring-1 ring-line dark:divide-white/10 dark:ring-white/10" data-schedule-list>
        {timed.map(({ h, i }) => (
          <li key={i} class="flex items-center gap-3 px-3 py-2">
            <span aria-hidden="true" class="size-2.5 shrink-0 rounded-full" style={{ background: seriesColour(i) }} />
            <span class="w-20 shrink-0 tabular-nums text-stone-600 dark:text-stone-300">{additionTime(h.minutes as number)}</span>
            <span class="min-w-0 flex-1 truncate text-ink dark:text-ink-light">{name(h, i)}</span>
            <span class="tabular-nums text-ink dark:text-ink-light">{h.grams as number} g</span>
          </li>
        ))}
      </ol>
      {missing}
    </div>
  );
}

/** An entry with a field set, or removed when cleared (an empty optional field leaves the file). */
function withField(entry: Ingredient, field: string, value: unknown): Ingredient {
  if (value === undefined && field !== "name" && field !== "grams") {
    const { [field]: _gone, ...rest } = entry;
    return rest;
  }
  return { ...entry, [field]: value };
}

/** The Malt or the Hops tab (GUI-032). */
export function IngredientsTab(props: {
  kind: IngredientKind;
  recipe: Recipe;
  problems: Problem[];
  onChange: (recipe: Recipe) => void;
  /** Opens the Water tab (the knockout volume, EDT-050). */
  onWater?: () => void;
}) {
  const { kind } = props;
  const list = ingredientsOf(props.recipe, kind);
  return (
    <>
      <p class={HINT_STYLE}>
        {kind === "malts"
          ? "The malts of the brew with their amounts and colours. The shares are of the total malt weight."
          : "The hops of the brew with their amounts, alpha acid and boil time. The shares are of the total hop weight."}
      </p>
      {/* The donut at the left, the figure at the right (EDT-047); stacked on a phone. */}
      <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start" data-overview>
        {list.some((e) => validGrams(e.grams)) && (
          <div class="shrink-0">
            <ShareDonut kind={kind} list={list} />
          </div>
        )}
        <div class="min-w-0 flex-1 space-y-3 rounded-lg bg-stone-50 p-3 ring-1 ring-line dark:bg-white/5 dark:ring-white/10">
          <FigureLine kind={kind} recipe={props.recipe} onWater={props.onWater} />
        </div>
      </div>
      <section class="mt-6" aria-labelledby={`${kind}-table-title`}>
        <h3 id={`${kind}-table-title`} class={`${SECTION_TITLE_STYLE} mb-2`}>
          {INGREDIENT_LABELS[kind].title}
        </h3>
        <IngredientTable kind={kind} recipe={props.recipe} problems={props.problems} onChange={props.onChange} />
      </section>
      {kind === "hops" && (
        <section class="mt-6" aria-labelledby="hop-schedule-title">
          <h3 id="hop-schedule-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
            Hop Schedule
          </h3>
          <HopSchedule list={list} />
        </section>
      )}
    </>
  );
}
