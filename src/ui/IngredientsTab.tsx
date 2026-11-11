/**
 * The Malt and Boiling tabs (EDT-041..060, QE-34, QE-35, QE-42): the malts, or the hops and other additions, as a table the brewer adds
 * rows to and sorts, a donut of each row's share of the total weight, and a figure computed from the table and the
 * batch: the beer colour (EBC) for the malts, the bitterness (IBU) for the hops. Shares and figures are computed,
 * never stored (app RCP-013).
 */

import { Fragment, type ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Problem } from "../validate";
import { balanceOf, beerColourHex, buGu } from "../brewMath";
import {
  INGREDIENT_EXTRA_FIELDS,
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
/** In this order after the name (EDT-042, QE-40): the absolute amount last, just before the relative one. */
const COLUMNS: Record<"malts" | "hops", Column[]> = {
  malts: [
    { field: "ebc", head: "EBC", label: "Colour (EBC)", integer: false, width: "w-24 sm:w-28" },
    { field: "grams", head: "Absolute amount (g)", label: "Absolute amount (g)", integer: true, width: "w-16 sm:w-28" },
  ],
  hops: [
    { field: "alpha", head: "α %", label: "Alpha acid (%)", integer: false, width: "w-12 sm:w-20" },
    { field: "minutes", head: "Cooking time (min)", label: "Cooking time (min)", integer: true, width: "w-14 sm:w-24" },
    { field: "grams", head: "Absolute amount (g)", label: "Absolute amount (g)", integer: true, width: "w-14 sm:w-24" },
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

/** The kinds of rows a tab's table holds (EDT-060): the malts; the hops, then the other boil additions. */
const TABLE_GROUPS: Record<"malts" | "hops", IngredientKind[]> = { malts: ["malts"], hops: ["hops", "others"] };

/**
 * One kind of rows in a table (EDT-042, EDT-060), in its own `<tbody>`: its rows, sorted by drag and drop within the
 * group (EDT-046), and its add row. `columns` are the table's; a field the kind doesn't have stays empty. Shares only
 * for the table's first kind (`shares`).
 */
function IngredientGroup(props: {
  kind: IngredientKind;
  columns: Column[];
  shares: boolean;
  recipe: Recipe;
  problems: Problem[];
  onChange: (recipe: Recipe) => void;
}) {
  const { kind, columns } = props;
  const { one } = INGREDIENT_LABELS[kind];
  const span = columns.length + 4;
  const fields = ["grams", ...INGREDIENT_EXTRA_FIELDS[kind]];
  const list = ingredientsOf(props.recipe, kind);
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
    <tbody ref={body} data-ingredient-group={kind}>
      {list.map((entry, i) => {
        const share = props.shares ? shareOf(entry, list) : undefined;
        return (
          <tr
            key={i}
            class={
              "relative border-t border-line dark:border-white/10 " +
              (reorder.dragging(i) ? "bg-berry/10 opacity-60 dark:bg-berry-light/10" : "")
            }
            data-ingredient={i}
            data-ingredient-kind={kind}
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
            {columns.map((c) =>
              !fields.includes(c.field) ? (
                <td key={c.field} class={CELL} />
              ) : (
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
              ),
            )}
            <td class={`${CELL} ${NUMBER} text-stone-600 dark:text-stone-300`} data-ingredient-share>
              {props.shares && (
                <span class="inline-flex items-center justify-end gap-1.5">
                  {share !== undefined && (
                    // On a phone the legend carries the colours, so the columns fit.
                    <span aria-hidden="true" class="hidden size-2.5 rounded-sm sm:inline-block" style={{ background: seriesColour(i) }} />
                  )}
                  {share === undefined ? "–" : formatShare(share)}
                </span>
              )}
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
      {list.length === 0 && props.shares && (
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
  );
}

/** A tab's table (EDT-042): the column heads, its groups of rows (EDT-060), and the Total of the first group. */
function IngredientTable(props: { kind: "malts" | "hops"; recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const { kind } = props;
  const columns = COLUMNS[kind];
  const span = columns.length + 4;
  const groups = TABLE_GROUPS[kind];
  const total = totalGrams(ingredientsOf(props.recipe, kind));
  return (
    <div class="relative overflow-x-auto rounded-lg ring-1 ring-line dark:ring-white/10" data-ingredients={kind}>
      <table aria-label={kind === "malts" ? "Malt" : "Boil ingredients"} class="w-full border-collapse text-sm">
        <thead class="bg-stone-50 dark:bg-white/5">
          <tr>
            <th class={`${HEAD} w-8`}>
              <span class="sr-only">Move</span>
            </th>
            <th class={`${HEAD} text-left`}>Name</th>
            {columns.map((c) => (
              <th key={c.field} class={`${HEAD} ${c.width} text-right ${c.head.length < 6 ? "whitespace-nowrap" : ""}`} title={c.label}>
                {c.head}
              </th>
            ))}
            <th class={`${HEAD} w-14 text-right sm:w-24`}>Relative amount (%)</th>
            <th class={`${HEAD} w-10`}>
              <span class="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        {groups.map((group, k) => (
          <Fragment key={group}>
            {k > 0 && (
              // The group's name (EDT-060): its rows follow, then its add row.
              <tbody>
                <tr class="border-t-2 border-line bg-stone-50/60 dark:border-white/15 dark:bg-white/[0.03]" data-group-label={group}>
                  <td colSpan={span} class={`${CELL} text-xs font-semibold text-stone-600 dark:text-stone-300`}>
                    {INGREDIENT_LABELS[group].title}
                    <span class="font-normal text-stone-500 dark:text-stone-400"> — not in the shares or the bitterness</span>
                  </td>
                </tr>
              </tbody>
            )}
            <IngredientGroup
              kind={group}
              columns={columns}
              shares={k === 0}
              recipe={props.recipe}
              problems={props.problems}
              onChange={props.onChange}
            />
          </Fragment>
        ))}
        <tfoot class="border-t-2 border-line font-semibold text-ink dark:border-white/20 dark:text-ink-light">
          <tr data-ingredient-total>
            <td class={CELL} />
            <td class={CELL}>{kind === "malts" ? "Total" : "Total hops"}</td>
            {columns.map((c) =>
              c.field === "grams" ? (
                <td key={c.field} class={`${CELL} ${NUMBER}`} data-total-grams>
                  {total} g
                </td>
              ) : (
                <td key={c.field} class={CELL} />
              ),
            )}
            <td class={`${CELL} ${NUMBER}`}>{total > 0 ? "100 %" : ""}</td>
            <td class={CELL} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** When a hop goes in (EDT-054): "start" at minute 0, "flame-out" at the end of the boil, else "7 min". */
export function additionText(addAt: number, boil: number, cooking: number): string {
  return addAt === 0 ? "0 min (start)" : cooking === 0 ? `${addAt} min (flame-out)` : `${addAt} min`;
}

/**
 * The hop schedule (EDT-054): the boil lasts as long as the longest cooking time; each hop goes in at that boil time
 * minus its own cooking time, counted from the start of the boil. Shown as a timeline from the start of the boil (left)
 * to its end (right), one row and dot per hop in its donut colour with a line for how long it cooks, and as a table in
 * the order of addition. Hops without a cooking time are named in a hint.
 */
function HopSchedule(props: { hops: Ingredient[]; others: Ingredient[] }) {
  const { box, width } = useWidth();
  type Entry = { h: Ingredient; i: number; kind: "hops" | "others" };
  const one = (kind: Entry["kind"]) => INGREDIENT_LABELS[kind].one;
  const name = ({ h, i, kind }: Entry) => (typeof h.name === "string" && h.name ? h.name : `${one(kind)} ${i + 1}`);
  // A hop in its donut colour (EDT-047); another addition in the "other" grey, as a square (EDT-060).
  const colour = ({ i, kind }: Entry) => (kind === "hops" ? seriesColour(i) : "var(--series-other)");
  const key = ({ i, kind }: Entry) => (kind === "hops" ? String(i) : `other-${i}`);
  const withAmount: Entry[] = [
    ...props.hops.map((h, i) => ({ h, i, kind: "hops" as const })),
    ...props.others.map((h, i) => ({ h, i, kind: "others" as const })),
  ].filter(({ h }) => validGrams(h.grams));
  const cooked = withAmount.filter(({ h }) => validBoilMinutes(h.minutes));
  const untimed = (["hops", "others"] as const).flatMap((kind) => {
    const rows = withAmount.filter((e) => e.kind === kind && !validBoilMinutes(e.h.minutes)).map(({ i }) => i + 1);
    const label = one(kind).toLowerCase();
    return rows.length === 0 ? [] : [rows.length === 1 ? `${label} ${rows[0]}` : `${label}s ${rows.join(", ")}`];
  });
  const missing =
    untimed.length === 0 ? null : (
      <p class={`${HINT_STYLE} mt-2`} data-schedule-missing>
        No cooking time yet: {untimed.join(", ")}.
      </p>
    );
  // The outer box is always there, so its width is measured from the start (also while there is no chart yet).
  if (cooked.length === 0) {
    return (
      <div ref={box} data-hop-schedule>
        <p class={HINT_STYLE}>Enter the amounts and cooking times to see when each goes into the boil.</p>
        {missing}
      </div>
    );
  }
  const boil = Math.max(...cooked.map(({ h }) => h.minutes as number));
  // Ties: hops before other additions, then table order.
  const timed = cooked
    .map((e, order) => ({ ...e, order, cooking: e.h.minutes as number, addAt: boil - (e.h.minutes as number) }))
    .sort((a, b) => a.addAt - b.addAt || a.order - b.order);
  const ROW = 26;
  const LABEL = 96;
  const top = 8;
  const axisY = top + timed.length * ROW + 4;
  const height = axisY + 30;
  const x0 = LABEL;
  const x1 = width - 12;
  const span = Math.max(1, boil);
  const x = (minuteOfBoil: number) => x0 + (minuteOfBoil / span) * (x1 - x0);
  const step = [5, 10, 15, 30, 60].find((st) => span / st <= Math.max(2, Math.floor((x1 - x0) / 70))) ?? 120;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, k) => k * step).filter((m) => m <= boil);
  if (!ticks.includes(boil)) {
    ticks.push(boil);
  }
  return (
    <div ref={box} data-hop-schedule>
      <p class="mb-2 text-sm text-ink dark:text-ink-light" data-boil-time>
        <span class="font-medium">Total boil time:</span> <span class="font-semibold tabular-nums">{boil} min</span>{" "}
        <span class={HINT_STYLE}>(the longest cooking time)</span>
      </p>
      <div class="rounded-lg bg-stone-50 ring-1 ring-line dark:bg-white/5 dark:ring-white/10">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Hop schedule over a ${boil}-minute boil: ${timed
            .map((e) => `${name(e)} ${e.h.grams} g added at ${additionText(e.addAt, boil, e.cooking)}`)
            .join(", ")}`}
          class="block max-w-full text-ink dark:text-ink-light"
        >
          {ticks.map((m) => (
            <g key={m} data-schedule-tick>
              <line x1={x(m)} x2={x(m)} y1={top} y2={axisY} class="stroke-stone-200 dark:stroke-white/10" />
              <text x={x(m)} y={axisY + 14} text-anchor="middle" class="fill-stone-500 text-[10px] dark:fill-stone-400">
                {m === 0 ? "start" : m === boil ? "end" : m}
              </text>
            </g>
          ))}
          <line x1={x0} x2={x1} y1={axisY} y2={axisY} class="stroke-stone-400 dark:stroke-stone-500" />
          <text x={x1} y={axisY + 26} text-anchor="end" class="fill-stone-500 text-[10px] dark:fill-stone-400">
            min after the start of the boil
          </text>
          {timed.map((e, row) => {
            const { h, addAt, cooking } = e;
            const y = top + row * ROW + ROW / 2;
            return (
              <g key={key(e)} data-schedule-hop={key(e)}>
                <title>{`${name(e)}: ${h.grams} g, add at ${additionText(addAt, boil, cooking)}, cooks ${cooking} min`}</title>
                <text x={8} y={y} dy="0.32em" class="fill-stone-600 text-[11px] tabular-nums dark:fill-stone-300">
                  {additionText(addAt, boil, cooking)}
                </text>
                {/* How long it cooks: from its addition to the end of the boil. */}
                <line x1={x(addAt)} x2={x(boil)} y1={y} y2={y} stroke={colour(e)} stroke-width={2} stroke-linecap="round" opacity={0.45} />
                {e.kind === "hops" ? (
                  <circle cx={x(addAt)} cy={y} r={6} fill={colour(e)} class="stroke-white stroke-2 dark:stroke-surface-dark" />
                ) : (
                  <rect x={x(addAt) - 5.5} y={y - 5.5} width={11} height={11} rx={2} fill={colour(e)} class="stroke-white stroke-2 dark:stroke-surface-dark" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div class="mt-3 overflow-hidden rounded-lg ring-1 ring-line dark:ring-white/10">
        <table class="w-full border-collapse text-sm" aria-label="Boil schedule" data-schedule-list>
          <thead class="bg-stone-50 dark:bg-white/5">
            <tr>
              <th class={`${HEAD} text-left`}>Add at</th>
              <th class={`${HEAD} text-left`}>Ingredient</th>
              <th class={`${HEAD} text-right`}>Cooking time</th>
              <th class={`${HEAD} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {timed.map((e) => (
              <tr key={key(e)} class="border-t border-line dark:border-white/10" data-schedule-row={key(e)}>
                <td class={`${CELL} whitespace-nowrap tabular-nums text-ink dark:text-ink-light`}>
                  <span class="inline-flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      class={`size-2.5 shrink-0 ${e.kind === "hops" ? "rounded-full" : "rounded-[2px]"}`}
                      style={{ background: colour(e) }}
                    />
                    {additionText(e.addAt, boil, e.cooking)}
                  </span>
                </td>
                <td class={`${CELL} text-ink dark:text-ink-light`}>{name(e)}</td>
                <td class={`${CELL} ${NUMBER} text-stone-600 dark:text-stone-300`}>{e.cooking} min</td>
                <td class={`${CELL} ${NUMBER} text-ink dark:text-ink-light`}>{e.h.grams as number} g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

/** The Malt or the Boiling tab (GUI-032). */
export function IngredientsTab(props: {
  kind: "malts" | "hops";
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
          : "The hops and other additions of the boil with their amounts and cooking times. The shares and the bitterness are of the hops."}
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
          {kind === "malts" ? "Malt" : "Boil Ingredients"}
        </h3>
        <IngredientTable kind={kind} recipe={props.recipe} problems={props.problems} onChange={props.onChange} />
      </section>
      {kind === "hops" && (
        <section class="mt-6" aria-labelledby="boil-schedule-title">
          <h3 id="boil-schedule-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
            Boil Schedule
          </h3>
          <HopSchedule hops={list} others={ingredientsOf(props.recipe, "others")} />
        </section>
      )}
    </>
  );
}
