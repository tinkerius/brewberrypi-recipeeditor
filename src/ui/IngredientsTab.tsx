/**
 * The Ingredients tab (EDT-041..045, QE-34): the malts and the hops of the brew, each a table the brewer adds rows
 * to with its "+ Add" row, below the entries. A row is a name and an amount in whole grams; its share of the table's
 * total weight is computed (not stored, app RCP-013), and the last line sums the weight.
 */

import { useEffect, useState } from "preact/hooks";
import type { Problem } from "../validate";
import {
  INGREDIENT_KINDS,
  INGREDIENT_LABELS,
  formatShare,
  ingredientsOf,
  shareOf,
  totalGrams,
  withIngredients,
  type Ingredient,
  type IngredientKind,
  type Recipe,
} from "../model";
import { ADD_ROW_LINE, AddRowButton } from "./AddRow";
import { DragHandle, DropLine } from "./DragHandle";
import { moveItem } from "./reorder";
import { useReorder } from "./useReorder";
import { NumberField, TextField } from "./fields";
import { BUTTON_STYLES, HINT_STYLE, SECTION_TITLE_STYLE } from "./styles";

const CELL = "px-1 py-2 align-middle first:pl-2 last:pr-2 sm:px-2 sm:first:pl-3 sm:last:pr-3";
const HEAD = `${CELL} text-[11px] font-semibold text-stone-600 sm:text-xs dark:text-stone-300`;
const NUMBER = "whitespace-nowrap text-right tabular-nums";

function IngredientTable(props: { kind: IngredientKind; recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const { kind } = props;
  const { title, one } = INGREDIENT_LABELS[kind];
  const list = ingredientsOf(props.recipe, kind);
  const total = totalGrams(list);
  const set = (next: Ingredient[]) => props.onChange(withIngredients(props.recipe, kind, next));
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
  const heading = `ingredients-${kind}-title`;
  return (
    <section aria-labelledby={heading} data-ingredients={kind}>
      <h3 id={heading} class={`${SECTION_TITLE_STYLE} mb-2`}>
        {title}
      </h3>
      <div class="relative overflow-x-auto rounded-lg ring-1 ring-line dark:ring-white/10">
        <table aria-labelledby={heading} class="w-full border-collapse text-sm">
          <thead class="bg-stone-50 dark:bg-white/5">
            <tr>
              <th class={`${HEAD} w-8`}>
                <span class="sr-only">Move</span>
              </th>
              <th class={`${HEAD} text-left`}>Name</th>
              <th class={`${HEAD} w-16 text-right sm:w-28`}>g</th>
              <th class={`${HEAD} w-12 text-right sm:w-20`}>%</th>
              <th class={`${HEAD} w-10`}>
                <span class="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody ref={body}>
            {list.length === 0 ? (
              <tr class="border-t border-line dark:border-white/10">
                <td colSpan={5} class={`${CELL} ${HINT_STYLE}`}>
                  No {one.toLowerCase()} yet.
                </td>
              </tr>
            ) : (
              list.map((entry, i) => {
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
                    <td class={CELL} data-ingredient-name>
                      <TextField
                        label={`Name, ${one} ${i + 1}`}
                        compact
                        value={entry.name}
                        invalid={invalid(i, "name")}
                        onChange={(name) => set(list.map((e, j) => (j === i ? { ...e, name } : e)))}
                      />
                    </td>
                    <td class={`${CELL} [&_input]:w-full! [&_span]:justify-end`}>
                      <NumberField
                        label={`Amount (g), ${one} ${i + 1}`}
                        compact
                        integer
                        value={entry.grams}
                        invalid={invalid(i, "grams")}
                        onChange={(grams) => set(list.map((e, j) => (j === i ? { ...e, grams } : e)))}
                      />
                    </td>
                    <td class={`${CELL} ${NUMBER} text-stone-600 dark:text-stone-300`} data-ingredient-share>
                      {share === undefined ? "–" : formatShare(share)}
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
              })
            )}
            <tr class={ADD_ROW_LINE}>
              <td colSpan={5} class="p-0">
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
              <td class={`${CELL} ${NUMBER}`}>{total > 0 ? "100 %" : ""}</td>
              <td class={CELL} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export function IngredientsTab(props: { recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  return (
    <>
      <p class={HINT_STYLE}>
        The malts and hops of the brew, each with its amount in grams. The shares are of each table's total weight.
      </p>
      <div class="mt-4 space-y-6">
        {INGREDIENT_KINDS.map((kind) => (
          <IngredientTable key={kind} kind={kind} recipe={props.recipe} problems={props.problems} onChange={props.onChange} />
        ))}
      </div>
    </>
  );
}
