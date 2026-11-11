/**
 * The Malt and Boiling tabs (EDT-041..060, QE-34, QE-35, QE-42): the malts, or the hops and other additions, as a table the brewer adds
 * rows to and sorts, a donut of each row's share of the total weight, and a figure computed from the table and the
 * batch: the beer colour (EBC) for the malts, the bitterness (IBU) for the hops. Shares and figures are computed,
 * never stored (app RCP-013).
 */

import { Fragment, type ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { Problem } from "../validate";
import { TYPICAL, type Warning } from "../warnings";
import { FieldNotes, hasWarning, notesAt, notesWhere, type Issues } from "./notes";
import { balanceOf, beerColourHex, buGu } from "../brewMath";
import {
  INGREDIENT_EXTRA_FIELDS,
  INGREDIENT_LABELS,
  batchOf,
  beerColourOf,
  bitternessOf,
  formatShare,
  ingredientsOf,
  ACID_MALT,
  maltsWithAcidMalt,
  waterOf,
  shareOf,
  totalGrams,
  validAlpha,
  validBoilMinutes,
  additionsOf,
  entryGrams,
  validGrams,
  withAdditions,
  validEbc,
  validLiters,
  validPlato,
  withIngredients,
  type Figure,
  type Ingredient,
  type Addition,
  type IngredientKind,
  type Recipe,
} from "../model";
import { ADD_ROW_LINE, AddRowButton } from "./AddRow";
import { AdditionIcon } from "./AdditionIcon";
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
/** A value shown as text in a field's place (the acid malt, EDT-070): the input's box without its frame. */
const PLAIN_VALUE = "block w-full py-1.5 text-sm text-ink ring-1 ring-transparent ring-inset dark:text-ink-light";

/** The chart colours in their fixed order (EDT-047); rows from the 9th on share "other". */
const SERIES = 8;
export const seriesColour = (i: number) => (i < SERIES ? `var(--series-${i + 1})` : "var(--series-other)");

/** The tones of a kind (QE-48): three that stay clearly apart, then one muted tone from the 4th row on. */
const SHADES = 3;

/**
 * A row's colour (EDT-047, QE-47, QE-48): malts in the categorical colours, hops in three greens, other additions in
 * three violets, in table order, then a muted tone of the kind.
 */
export function rowColour(kind: IngredientKind, i: number): string {
  if (kind === "malts") {
    return seriesColour(i);
  }
  const ramp = kind === "hops" ? "hop" : "addition";
  return i < SHADES ? `var(--${ramp}-${i + 1})` : `var(--${ramp}-more)`;
}

/**
 * A column of a row (EDT-042, EDT-061): a number field (a malt's grams and EBC, a hop's alpha acid), the additions
 * of a hop or another addition (cooking time and amount each), or their computed total amount.
 */
type Column = {
  field: "grams" | "ebc" | "alpha" | "additions" | "total";
  head: string;
  label: string;
  integer: boolean;
  width: string;
  /** The typical value, a second line in the column head (EDT-068, QE-60): the range outside which it warns. */
  typical?: string;
};
/** In this order after the name (EDT-042, QE-40): the absolute amount last, just before the relative one. */
const COLUMNS: Record<IngredientKind, Column[]> = {
  malts: [
    { field: "ebc", head: "EBC", label: "Colour (EBC)", integer: false, width: "w-24 sm:w-28" },
    { field: "grams", head: "Absolute amount (g)", label: "Absolute amount (g)", integer: true, width: "w-16 sm:w-28" },
  ],
  hops: [
    {
      field: "alpha",
      head: "α %",
      label: "Alpha acid (%)",
      integer: false,
      width: "w-12 sm:w-20",
      typical: `${TYPICAL.alpha.min}–${TYPICAL.alpha.max}`,
    },
    {
      field: "additions",
      head: "Additions (cooking time · amount)",
      label: "Additions",
      integer: true,
      width: "w-52 sm:w-64",
      typical: `cooking time up to ${TYPICAL.hopMinutes.max} min`,
    },
    { field: "total", head: "Absolute amount (g)", label: "Absolute amount (g)", integer: true, width: "w-14 sm:w-24" },
  ],
  others: [
    { field: "additions", head: "Additions (cooking time · amount)", label: "Additions", integer: true, width: "w-52 sm:w-64" },
    { field: "total", head: "Absolute amount (g)", label: "Absolute amount (g)", integer: true, width: "w-14 sm:w-24" },
  ],
};

/**
 * Whether a kind's table has the column Relative amount (EDT-043): only the malts. The hops' shares are in their donut
 * (QE-52); other additions have none (EDT-060).
 */
const HAS_SHARES: Record<IngredientKind, boolean> = { malts: true, hops: false, others: false };

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
              stroke={rowColour(props.kind, s.i)}
              stroke-width={width}
              stroke-dasharray={dash}
              stroke-dashoffset={-offset}
              class="transition-opacity hover:opacity-80"
            >
              <title>{`${name(s.entry, s.i)}: ${entryGrams(s.entry)} g, ${formatShare(s.share)}`}</title>
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
              <span aria-hidden="true" class="size-3 shrink-0 rounded-sm" style={{ background: rowColour(props.kind, s.i) }} />
              <span class="text-ink dark:text-ink-light">{name(s.entry, s.i)}</span>
              <span class="tabular-nums text-stone-500 dark:text-stone-400">{formatShare(s.share)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** The tabs the batch is entered on (EDT-050): the knockout volume on Water, the original gravity on Fermentation. */
export type BatchTab = "water" | "fermentation";
const BATCH_TAB_NAMES: Record<BatchTab, string> = { water: "Water tab", fermentation: "Fermentation tab" };

/** A link to the tab where a batch value is entered (EDT-050, QE-56). */
function TabLink(props: { tab: BatchTab; onTab?: (tab: BatchTab) => void }) {
  return props.onTab ? (
    <button type="button" class={LINK_STYLE} data-tab-link={props.tab} onClick={() => props.onTab!(props.tab)}>
      {BATCH_TAB_NAMES[props.tab]}
    </button>
  ) : (
    <>{BATCH_TAB_NAMES[props.tab]}</>
  );
}

/** Why a figure can't be computed yet (EDT-048, EDT-049), as a hint: what to enter, and where. */
function missingText(kind: IngredientKind, figure: Figure, onTab?: (tab: BatchTab) => void): ComponentChildren {
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
  // The knockout volume is entered on the Water tab, the original gravity on the Fermentation tab (EDT-050, QE-56).
  const batch = figure.batch ?? [];
  if (batch.includes("liters")) {
    needs.push(
      <>
        the knockout volume on the <TabLink tab="water" onTab={onTab} />
      </>,
    );
  }
  if (batch.includes("plato")) {
    needs.push(
      <>
        the original gravity on the <TabLink tab="fermentation" onTab={onTab} />
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
 * common beers (EDT-055), or the bitterness; the knockout volume comes from the Water tab, the original gravity from
 * the Fermentation tab.
 */
function FigureLine(props: { kind: IngredientKind; recipe: Recipe; onTab?: (tab: BatchTab) => void }) {
  const malts = props.kind === "malts";
  // How the figure is computed, behind an ⓘ button next to it (QE-44).
  const [about, setAbout] = useState(false);
  const aboutId = `figure-about-${props.kind}`;
  const figure = malts ? beerColourOf(props.recipe) : bitternessOf(props.recipe);
  const label = malts ? "Beer colour" : "Bitterness";
  const { liters, plato } = batchOf(props.recipe);
  const knockout = (
    <>
      the knockout volume ({validLiters(liters) ? `${liters} L, ` : ""}
      <TabLink tab="water" onTab={props.onTab} />)
    </>
  );
  const gravity = (
    <>
      the original gravity ({validPlato(plato) ? `${plato} °P, ` : ""}
      <TabLink tab="fermentation" onTab={props.onTab} />)
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
        {figure.value !== undefined && (
          <button
            type="button"
            data-figure-info
            class={
              "inline-flex size-5 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-light " +
              (about
                ? "bg-ink text-paper ring-ink dark:bg-ink-light dark:text-ink dark:ring-ink-light"
                : "text-stone-600 ring-stone-300 hover:bg-stone-100 dark:text-stone-300 dark:ring-white/20 dark:hover:bg-white/10")
            }
            aria-expanded={about}
            aria-controls={aboutId}
            aria-label={`How the ${label.toLowerCase()} is calculated`}
            title="How it is calculated"
            onClick={() => setAbout(!about)}
          >
            i
          </button>
        )}
      </p>
      {figure.value !== undefined && about && (
        // Right below its ⓘ button.
        <p
          id={aboutId}
          class="mt-2 rounded-md bg-white p-2.5 text-xs text-stone-700 ring-1 ring-line dark:bg-white/5 dark:text-stone-300 dark:ring-white/10"
          data-figure-about
        >
          {malts ? (
            <>Morey's formula, from each malt's EBC and {knockout}.</>
          ) : (
            <>Tinseth's formula, from each hop's alpha acid and boil time, {knockout} and {gravity}.</>
          )}
        </p>
      )}
      {malts && figure.value !== undefined && <BeerColourScale ebc={figure.value} />}
      {!malts && figure.value !== undefined && <BitternessScale ibu={figure.value} />}
      {ratio !== undefined && (
        <div class="mt-4">
          {/* A heading line like the bitterness's (QE-44): the ratio and how it reads. */}
          <p class="flex items-center gap-2 text-sm font-medium text-ink dark:text-ink-light" data-bu-gu>
            BU:GU:
            <span class="text-base font-semibold tabular-nums">{ratio.toFixed(2)}</span>
            <span class="text-stone-600 dark:text-stone-300">{balanceOf(ratio)}</span>
          </p>
          <BalanceScale ratio={ratio} />
        </div>
      )}
      {figure.value === undefined && (
        // What is missing stays visible: it says what to enter.
        <p class={`${HINT_STYLE} mt-1`} data-figure-hint>
          {missingText(props.kind, figure, props.onTab)}
        </p>
      )}
    </div>
  );
}

/**
 * A hop's or another addition's additions in one cell (EDT-061, QE-49): per addition its cooking time and amount,
 * removable while there is more than one, and "+ addition" to add one at the end.
 */
function AdditionsCell(props: {
  kind: IngredientKind;
  index: number;
  entry: Ingredient;
  problems: Problem[];
  warnings: Warning[];
  onChange: (additions: Addition[]) => void;
}) {
  const additions = additionsOf(props.entry);
  const { one } = INGREDIENT_LABELS[props.kind];
  const at = (j: number, field: string) => `ingredients.${props.kind}[${props.index}].additions[${j}].${field}`;
  const invalid = (j: number, field: string) => props.problems.some((p) => p.path === at(j, field));
  const warn = (j: number, field: string) => props.warnings.some((w) => w.path === at(j, field));
  const set = (j: number, field: "minutes" | "grams", value: unknown) =>
    props.onChange(
      additions.map((a, k) => {
        if (k !== j) {
          return a;
        }
        const { [field]: _old, ...rest } = a;
        // In the file's order: minutes, then grams (FMT-006).
        const next = { ...rest, ...(value === undefined ? {} : { [field]: value }) };
        const { minutes, grams, ...more } = next as Addition;
        return { ...(minutes !== undefined ? { minutes } : {}), ...(grams !== undefined ? { grams } : {}), ...more };
      }),
    );
  return (
    <div class="space-y-1">
      {additions.map((a, j) => (
        <div key={j} class="flex items-center gap-1.5 [&_input]:w-14! [&_input]:px-1.5! sm:[&_input]:w-16!" data-addition={j}>
          <span class="contents" data-addition-field="minutes">
            <NumberField
              label={`Cooking time (min), ${one} ${props.index + 1}, addition ${j + 1}`}
              compact
              integer
              unit="min"
              value={a.minutes}
              invalid={invalid(j, "minutes")}
              warn={warn(j, "minutes")}
              onChange={(v) => set(j, "minutes", v)}
            />
          </span>
          <span class="contents" data-addition-field="grams">
            <NumberField
              label={`Amount (g), ${one} ${props.index + 1}, addition ${j + 1}`}
              compact
              integer
              unit="g"
              value={a.grams}
              invalid={invalid(j, "grams")}
              onChange={(v) => set(j, "grams", v)}
            />
          </span>
          {additions.length > 1 && (
            <button
              type="button"
              class="inline-flex size-6 items-center justify-center rounded text-xs text-stone-500 hover:bg-stone-100 hover:text-ink dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-ink-light"
              title="Remove addition"
              aria-label={`Remove addition ${j + 1} of ${one.toLowerCase()} ${props.index + 1}`}
              onClick={() => props.onChange(additions.filter((_, k) => k !== j))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        class="text-xs font-semibold text-berry hover:underline dark:text-berry-light"
        data-add-addition
        onClick={() => props.onChange([...additions, {}])}
      >
        + addition
      </button>
    </div>
  );
}

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
  warnings: Warning[];
  onChange: (recipe: Recipe) => void;
  /** Opens the Water tab, where the acid malt comes from (EDT-070). */
  onWater?: () => void;
}) {
  const { kind, columns } = props;
  const issues: Issues = { problems: props.problems, warnings: props.warnings };
  const { one } = INGREDIENT_LABELS[kind];
  const span = columns.length + (props.shares ? 4 : 3);
  const fields = [...INGREDIENT_EXTRA_FIELDS[kind], "total"];
  const list = ingredientsOf(props.recipe, kind);
  // The malts the shares count: with the water treatment's acid malt, shown read-only after them (EDT-070).
  const counted = kind === "malts" ? maltsWithAcidMalt(props.recipe) : list;
  const acid = counted.length > list.length ? counted[counted.length - 1] : undefined;
  const treatment = waterOf(props.recipe).treatment;
  const acidShare = typeof treatment === "object" && treatment !== null ? (treatment as Record<string, unknown>).acid_malt : undefined;
  const set = (next: Ingredient[]) => props.onChange(withIngredients(props.recipe, kind, next));
  const setField = (i: number, field: string, value: unknown) =>
    set(list.map((e, j) => (j === i ? withField(e, field, value) : e)));
  const invalid = (i: number, field: string) => props.problems.some((p) => p.path === `ingredients.${kind}[${i}].${field}`);
  const warn = (i: number, field: string) => hasWarning(notesAt(issues, `ingredients.${kind}[${i}].${field}`));
  // A row's errors and warnings, in a line right below it (EDT-062).
  const rowNotes = (i: number) => {
    const at = `ingredients.${kind}[${i}]`;
    return notesWhere(issues, (path) => path === at || path.startsWith(`${at}.`));
  };
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
        const share = props.shares ? shareOf(entry, counted) : undefined;
        const notes = rowNotes(i);
        return (
          <Fragment key={i}>
          <tr
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
              {/* A boil ingredient's icon in its colour, as in the donut and the Boil Schedule (QE-52). */}
              <div class="flex items-center gap-2">
                {kind !== "malts" && (
                  <span class="shrink-0" data-row-icon>
                    <AdditionIcon kind={kind} colour={rowColour(kind, i)} />
                  </span>
                )}
                <div class="min-w-0 flex-1">
                  <TextField
                    label={`Name, ${one} ${i + 1}`}
                    compact
                    value={entry.name}
                    invalid={invalid(i, "name")}
                    onChange={(name) => setField(i, "name", name)}
                  />
                </div>
              </div>
            </td>
            {columns.map((c) =>
              !fields.includes(c.field) ? (
                <td key={c.field} class={CELL} />
              ) : c.field === "additions" ? (
                <td key={c.field} class={`${CELL} min-w-52`} data-additions>
                  <AdditionsCell
                    kind={kind}
                    index={i}
                    entry={entry}
                    problems={props.problems}
                    warnings={props.warnings}
                    onChange={(additions) => set(list.map((e, j) => (j === i ? withAdditions(e, additions) : e)))}
                  />
                </td>
              ) : c.field === "total" ? (
                // The hop's total: the sum of its additions' amounts (EDT-061).
                <td key={c.field} class={`${CELL} ${NUMBER} text-ink dark:text-ink-light`} data-entry-total>
                  {entryGrams(entry) > 0 ? `${entryGrams(entry)} g` : "–"}
                </td>
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
                      warn={warn(i, c.field)}
                      onChange={(v) => setField(i, c.field, v)}
                    />
                  </div>
                </td>
              ),
            )}
            {props.shares && (
              <td class={`${CELL} ${NUMBER} text-stone-600 dark:text-stone-300`} data-ingredient-share>
                <span class="inline-flex items-center justify-end gap-1.5">
                  {share !== undefined && (
                    // On a phone the legend carries the colours, so the columns fit.
                    <span aria-hidden="true" class="hidden size-2.5 rounded-sm sm:inline-block" style={{ background: rowColour(kind, i) }} />
                  )}
                  {share === undefined ? "–" : formatShare(share)}
                </span>
              </td>
            )}
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
          {notes.length > 0 && (
            <tr data-row-note={i}>
              <td />
              <td colSpan={span - 1} class="px-1 pb-2 sm:px-2">
                <FieldNotes notes={notes} />
              </td>
            </tr>
          )}
          </Fragment>
        );
      })}
      {acid && (
        // The water treatment's acid malt (EDT-070, QE-67, QE-68): a row like the others whose fields can't be changed,
        // worked out from its share, never in the file.
        <tr class="border-t border-line dark:border-white/10" data-acid-malt>
          <td class={CELL} />
          <td class={`${CELL} min-w-32 sm:min-w-0 [&_input]:px-2! sm:[&_input]:px-3!`} data-ingredient-name>
            {/* Like the other rows, as text where their fields' text sits (QE-70): it comes from the Water treatment. */}
            <span class={`${PLAIN_VALUE} px-2 sm:px-3`} data-acid-malt-value="name">
              {acid.name as string}
            </span>
            <span class={`${HINT_STYLE} mt-1 block`} data-acid-malt-hint>
              From the Water treatment ({String(acidShare)} % of the total malt); change it on the{" "}
              {props.onWater ? (
                <button type="button" class={LINK_STYLE} onClick={props.onWater}>
                  Water tab
                </button>
              ) : (
                "Water tab"
              )}
              .
            </span>
          </td>
          {columns.map((c) => (
            <td
              key={c.field}
              class={`${CELL} ${c.field === "ebc" ? "min-w-22" : "min-w-14"} sm:min-w-0 [&_input]:w-full! [&_input]:px-1.5! sm:[&_input]:px-3! [&_span]:justify-end`}
              data-acid-malt-field={c.field}
            >
              <div class="flex items-center gap-1.5">
                {c.field === "ebc" && (
                  <span
                    aria-hidden="true"
                    data-malt-swatch
                    title={`About the colour of ${String(acid.ebc)} EBC`}
                    class="size-4 shrink-0 rounded-sm ring-1 ring-black/10 dark:ring-white/20"
                    style={{ background: beerColourHex(acid.ebc as number) }}
                  />
                )}
                <span class={`${PLAIN_VALUE} px-1.5 text-right tabular-nums sm:px-3`} data-acid-malt-value={c.field}>
                  {String(acid[c.field])}
                </span>
              </div>
            </td>
          ))}
          {props.shares && (
            <td class={`${CELL} ${NUMBER} text-stone-600 dark:text-stone-300`} data-ingredient-share>
              <span class="inline-flex items-center justify-end gap-1.5">
                <span aria-hidden="true" class="hidden size-2.5 rounded-sm sm:inline-block" style={{ background: rowColour(kind, list.length) }} />
                {formatShare(shareOf(acid, counted) ?? 0)}
              </span>
            </td>
          )}
          <td class={CELL} />
        </tr>
      )}
      {counted.length === 0 && (
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
              // A hop or another addition starts with one addition to fill in (EDT-061).
              set([...list, kind === "malts" ? { name: "" } : { name: "", additions: [{}] }]);
              setFocusRow(list.length);
            }}
          />
        </td>
      </tr>
    </tbody>
  );
}

/**
 * A table of one kind (EDT-042): the malts, the hops, or the other boil additions (EDT-060), with its column heads, its
 * rows and add row (`IngredientGroup`) and its Total.
 */
function IngredientTable(props: {
  kind: IngredientKind;
  recipe: Recipe;
  problems: Problem[];
  warnings: Warning[];
  onChange: (recipe: Recipe) => void;
  onWater?: () => void;
}) {
  const { kind } = props;
  const columns = COLUMNS[kind];
  const shares = HAS_SHARES[kind];
  // The malts' total includes the water treatment's acid malt (EDT-070).
  const total = totalGrams(kind === "malts" ? maltsWithAcidMalt(props.recipe) : ingredientsOf(props.recipe, kind));
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
              <th
                key={c.field}
                class={`${HEAD} ${c.width} text-right ${c.head.length < 6 ? "whitespace-nowrap" : ""}`}
                title={c.typical ? `${c.label}; typical ${c.typical}` : c.label}
              >
                {c.head}
                {/* The typical value below the head (EDT-068), like the Mashing tab's Typical column. */}
                {c.typical && (
                  <span class="block text-[10px] font-normal text-stone-500 sm:text-[11px] dark:text-stone-400" data-head-typical>
                    <span class="sr-only">, typical </span>
                    {c.typical}
                  </span>
                )}
              </th>
            ))}
            {shares && <th class={`${HEAD} w-14 text-right sm:w-24`}>Relative amount (%)</th>}
            <th class={`${HEAD} w-10`}>
              <span class="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <IngredientGroup
          kind={kind}
          columns={columns}
          shares={shares}
          recipe={props.recipe}
          problems={props.problems}
          warnings={props.warnings}
          onChange={props.onChange}
          onWater={props.onWater}
        />
        <tfoot class="border-t-2 border-line font-semibold text-ink dark:border-white/20 dark:text-ink-light">
          <tr data-ingredient-total>
            <td class={CELL} />
            <td class={CELL}>Total</td>
            {columns.map((c) =>
              c.field === "grams" || c.field === "total" ? (
                <td key={c.field} class={`${CELL} ${NUMBER}`} data-total-grams>
                  {total} g
                </td>
              ) : (
                <td key={c.field} class={CELL} />
              ),
            )}
            {shares && <td class={`${CELL} ${NUMBER}`}>{total > 0 ? "100 %" : ""}</td>}
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
 * minus its own cooking time, counted from the start of the boil. Shown as one table in the order of addition (QE-51):
 * the additions that go in together grouped under their add time, each row with its ingredient, amount and a bar on a
 * timeline from the start of the boil (left) to its end (right) for how long it cooks, in the row's colour. Additions
 * without a cooking time are named in a hint.
 */
function HopSchedule(props: { hops: Ingredient[]; others: Ingredient[] }) {
  const { box, width } = useWidth();
  // One entry per addition (EDT-061): the hop (or other addition) `h`, row `i`, its addition `a`, number `j`.
  type Entry = { h: Ingredient; i: number; a: Addition; j: number; kind: "hops" | "others" };
  const one = (kind: Entry["kind"]) => INGREDIENT_LABELS[kind].one;
  const name = ({ h, i, kind }: Entry) => (typeof h.name === "string" && h.name ? h.name : `${one(kind)} ${i + 1}`);
  // A hop as a hop cone in its green (its donut colour), another addition as a jar in its violet (QE-48).
  const colour = ({ i, kind }: Entry) => rowColour(kind, i);
  const key = ({ i, j, kind }: Entry) => `${kind === "hops" ? "hop" : "other"}-${i}-${j}`;
  const entries = (kind: Entry["kind"], list: Ingredient[]) =>
    list.flatMap((h, i) => additionsOf(h).map((a, j) => ({ h, i, a, j, kind })));
  const withAmount: Entry[] = [...entries("hops", props.hops), ...entries("others", props.others)].filter(({ a }) =>
    validGrams(a.grams),
  );
  const cooked = withAmount.filter(({ a }) => validBoilMinutes(a.minutes));
  const untimed = (["hops", "others"] as const).flatMap((kind) => {
    const rows = [...new Set(withAmount.filter((e) => e.kind === kind && !validBoilMinutes(e.a.minutes)).map(({ i }) => i + 1))];
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
  const boil = Math.max(...cooked.map(({ a }) => a.minutes as number));
  // Ties: hops before other additions, then table order.
  const timed = cooked
    .map((e, order) => ({ ...e, order, cooking: e.a.minutes as number, addAt: boil - (e.a.minutes as number) }))
    .sort((a, b) => a.addAt - b.addAt || a.order - b.order);
  // The timeline column's width, estimated from the box (the table's other columns take about 440 px; on a phone the
  // bar has its own line): for the ticks and whether a bar's cooking time fits on it.
  const phone = width < 560;
  const line = Math.max(120, phone ? width - 24 : width - 440);
  const span = Math.max(1, boil);
  const at = (minuteOfBoil: number) => `${(minuteOfBoil / span) * 100}%`;
  const step = [5, 10, 15, 30, 60].find((st) => span / st <= Math.max(2, Math.floor(line / 70))) ?? 120;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, k) => k * step).filter((m) => m <= boil);
  if (!ticks.includes(boil)) {
    ticks.push(boil);
  }
  const grid = ticks.map((m) => (
    <span key={m} class="absolute inset-y-0 border-l border-stone-200 dark:border-white/10" style={{ left: at(m) }} />
  ));
  // On a phone each row is a grid: the add time on its own line, then ingredient and amount, then the bar (QE-51).
  const ROW_GRID = "max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:px-1";
  return (
    <div ref={box} data-hop-schedule>
      <p class="mb-2 text-sm text-ink dark:text-ink-light" data-boil-time>
        <span class="font-medium">Total boil time:</span> <span class="font-semibold tabular-nums">{boil} min</span>
      </p>
      <div class="rounded-lg ring-1 ring-line dark:ring-white/10">
        <table class="w-full border-collapse text-sm max-sm:block" aria-label="Boil schedule" data-schedule-list>
          <thead class="bg-stone-50 max-sm:block dark:bg-white/5">
            <tr class={ROW_GRID}>
              <th class={`${HEAD} text-left max-sm:hidden`}>Add at</th>
              <th class={`${HEAD} text-left max-sm:hidden`}>Ingredient</th>
              <th class={`${HEAD} text-right max-sm:hidden`}>Amount</th>
              {/* The time axis of the boil, from its start to its end (EDT-054). */}
              <th class={`${HEAD} w-full max-sm:col-span-2 sm:min-w-48`} data-schedule-axis>
                <span class="sr-only">Cooking time</span>
                <div class="relative mx-2 h-4" aria-hidden="true">
                  {ticks.map((m) => (
                    <span
                      key={m}
                      class={`absolute top-0 whitespace-nowrap font-normal text-stone-500 tabular-nums dark:text-stone-400 ${
                        m === 0 ? "" : m === boil ? "-translate-x-full" : "-translate-x-1/2"
                      }`}
                      style={{ left: at(m) }}
                      data-schedule-tick
                    >
                      {m === 0 ? "start" : m === boil ? "end" : m}
                    </span>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="max-sm:block">
            {timed.map((e, n) => {
              const first = n === 0 || timed[n - 1].addAt !== e.addAt;
              const together = timed.filter((t) => t.addAt === e.addAt).length;
              const when = additionText(e.addAt, boil, e.cooking);
              const tooltip = `${name(e)}: ${e.a.grams} g, add at ${when}, cooks ${e.cooking} min`;
              // The cooking time on the bar while it fits, else just left of it (a flame-out addition: a thin mark).
              const fits = (e.cooking / span) * line >= 56;
              return (
                <tr
                  key={key(e)}
                  class={`${ROW_GRID} ${
                    first ? "border-t border-line dark:border-white/10" : "border-t border-dashed border-line/60 dark:border-white/5"
                  }`}
                  data-schedule-row={key(e)}
                  data-schedule-hop={key(e)}
                  data-schedule-first={first ? "" : undefined}
                  title={tooltip}
                >
                  {/* The add time once per group of additions that go in together; read out on every row. */}
                  <td
                    class={`${CELL} whitespace-nowrap tabular-nums text-ink max-sm:col-span-2 max-sm:pb-0 dark:text-ink-light ${
                      first ? "" : "max-sm:hidden"
                    }`}
                    data-schedule-at
                  >
                    {first ? (
                      <>
                        {when}
                        {together > 1 && (
                          <span
                            class="ml-2 rounded-full bg-stone-100 px-1.5 text-xs text-stone-600 dark:bg-white/10 dark:text-stone-300"
                            title={`${together} additions at ${when}`}
                            data-schedule-count
                          >
                            {together}×
                          </span>
                        )}
                      </>
                    ) : (
                      <span class="sr-only">{when}</span>
                    )}
                  </td>
                  <td class={`${CELL} text-ink max-sm:pb-0 dark:text-ink-light`} data-schedule-ingredient>
                    <span class="inline-flex items-center gap-2">
                      {/* A hop cone or a jar, in the row's colour (QE-46). */}
                      <AdditionIcon kind={e.kind} colour={colour(e)} />
                      <span>
                        {name(e)}
                        {/* A hop's alpha acid after its name (QE-46, QE-47): "Hallertauer (12 % α)". */}
                        {e.kind === "hops" && validAlpha(e.h.alpha) && (
                          <span class="whitespace-nowrap text-stone-500 dark:text-stone-400" data-schedule-alpha>
                            {" "}
                            ({e.h.alpha} % α)
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td class={`${CELL} ${NUMBER} text-ink max-sm:pb-0 dark:text-ink-light`} data-schedule-amount>
                    {e.a.grams as number} g
                  </td>
                  <td class={`${CELL} max-sm:col-span-2 max-sm:pt-1`} data-schedule-cooking>
                    <div class="relative mx-2 h-6 max-sm:h-5">
                      {grid}
                      <div
                        class="absolute inset-y-1 right-0 flex items-center justify-end rounded-r-sm pr-1.5 text-[11px] font-semibold text-ink tabular-nums max-sm:inset-y-0.5 dark:text-ink-light"
                        // A tint of the row's colour, with a solid edge where it goes in (legible in both modes).
                        style={{
                          left: e.cooking === 0 ? "calc(100% - 7px)" : at(e.addAt),
                          background: e.cooking === 0 ? colour(e) : `color-mix(in srgb, ${colour(e)} 35%, transparent)`,
                          borderLeft: `3px solid ${colour(e)}`,
                        }}
                        data-schedule-bar
                      >
                        {fits && `${e.cooking} min`}
                      </div>
                      {!fits && (
                        <span
                          class="absolute top-1/2 -translate-x-full -translate-y-1/2 pr-1.5 text-[11px] font-semibold whitespace-nowrap text-ink tabular-nums dark:text-ink-light"
                          style={{ left: e.cooking === 0 ? "calc(100% - 7px)" : at(e.addAt) }}
                        >
                          {e.cooking} min
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class={`${HINT_STYLE} px-3 pb-2 pt-1 text-right text-[11px]`} data-schedule-caption>
          Bar: cooking time · min after the start of the boil
        </p>
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
  warnings: Warning[];
  onChange: (recipe: Recipe) => void;
  /** Opens the Water tab (the knockout volume) or the Fermentation tab (the original gravity; EDT-050). */
  onTab?: (tab: BatchTab) => void;
}) {
  const { kind } = props;
  // The donut counts the water treatment's acid malt with the malts (EDT-070).
  const list = kind === "malts" ? maltsWithAcidMalt(props.recipe) : ingredientsOf(props.recipe, kind);
  return (
    <>
      <section aria-labelledby={`${kind}-overview-title`}>
        <h3 id={`${kind}-overview-title`} class={`${SECTION_TITLE_STYLE} mb-2`}>
          {kind === "malts" ? "Malt Overview" : "Hops Overview"}
        </h3>
        {/* The donut at the left, the figure at the right (EDT-047); stacked on a phone. */}
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start" data-overview>
          {list.some((e) => entryGrams(e) > 0) && (
            <div class="shrink-0">
              <ShareDonut kind={kind} list={list} />
            </div>
          )}
          <div class="min-w-0 flex-1 space-y-3 rounded-lg bg-stone-50 p-3 ring-1 ring-line dark:bg-white/5 dark:ring-white/10">
            <FigureLine kind={kind} recipe={props.recipe} onTab={props.onTab} />
          </div>
        </div>
      </section>
      {/* On Boiling the schedule comes before the table (QE-43). */}
      {kind === "hops" && (
        <section class="mt-6" aria-labelledby="boil-schedule-title">
          <h3 id="boil-schedule-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
            Boil Schedule
          </h3>
          <HopSchedule hops={list} others={ingredientsOf(props.recipe, "others")} />
        </section>
      )}
      <section class="mt-6" aria-labelledby={`${kind}-table-title`}>
        <h3 id={`${kind}-table-title`} class={`${SECTION_TITLE_STYLE} mb-2`}>
          {kind === "malts" ? "Malt" : "Boil Ingredients"}
        </h3>
        {kind === "malts" ? (
          <IngredientTable
            kind="malts"
            recipe={props.recipe}
            problems={props.problems}
            warnings={props.warnings}
            onChange={props.onChange}
            onWater={() => props.onTab?.("water")}
          />
        ) : (
          // Two tables (EDT-060, QE-44): the hops, then the other additions, each with its own heading and Total.
          (["hops", "others"] as const).map((k) => (
            <div key={k} class="mt-3 first:mt-0" data-boil-table={k}>
              <h4 class="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-ink-light">
                {/* The icon the Boil Schedule uses for this kind (QE-46). */}
                <AdditionIcon kind={k} colour={rowColour(k, 2)} />
                {INGREDIENT_LABELS[k].title}
                {k === "others" && (
                  <span class="font-normal text-stone-500 dark:text-stone-400"> — not in the shares or the bitterness</span>
                )}
              </h4>
              <IngredientTable kind={k} recipe={props.recipe} problems={props.problems} warnings={props.warnings} onChange={props.onChange} />
            </div>
          ))
        )}
      </section>
    </>
  );
}
