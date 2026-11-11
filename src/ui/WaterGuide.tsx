/**
 * The water guide on the Water tab (EDT-067, QE-58): how much mash water to use by beer style, per kg of malt and in
 * litres for this recipe's malt, and an estimate of the total and the sparge water. Hints only: nothing is stored or
 * checked.
 */

import { MASH_WATER_BY_STYLE, ingredientsOf, totalGrams, waterEstimate, type Recipe } from "../model";
import { HINT_STYLE } from "./styles";

/** One decimal, without a trailing ".0": "13.5", "18". */
const oneDecimal = (value: number) => String(Math.round(value * 10) / 10);

const STRONG = "font-semibold tabular-nums text-ink dark:text-ink-light";
const TERM = "font-medium text-ink dark:text-ink-light";

export function WaterGuide(props: { recipe: Recipe }) {
  const kg = totalGrams(ingredientsOf(props.recipe, "malts")) / 1000;
  const estimate = waterEstimate(props.recipe);
  const cell = "py-1 pr-4 align-top";
  return (
    <aside
      class="mt-4 rounded-lg bg-stone-50 p-3 text-sm ring-1 ring-line dark:bg-white/5 dark:ring-white/10"
      aria-labelledby="water-guide-title"
      data-water-guide
    >
      <h4 id="water-guide-title" class="font-semibold text-ink dark:text-ink-light">
        Water guide
      </h4>
      <p class={`${HINT_STYLE} mt-1`}>
        Mash water by beer style{kg > 0 ? ` (for your ${oneDecimal(kg)} kg of malt)` : ""}: light beers are mashed thinner, dark and
        strong ones thicker.
      </p>
      <table class="mt-1 text-sm" data-water-styles>
        <tbody>
          {MASH_WATER_BY_STYLE.map((s) => (
            <tr key={s.styles}>
              <td class={`${cell} text-ink dark:text-ink-light`}>{s.styles}</td>
              <td class={`${cell} whitespace-nowrap tabular-nums text-stone-600 dark:text-stone-300`}>
                {s.min}–{s.max} L/kg
              </td>
              {kg > 0 && (
                <td class={`${cell} whitespace-nowrap ${STRONG}`} data-style-litres>
                  {oneDecimal(s.min * kg)}–{oneDecimal(s.max * kg)} L
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {"missing" in estimate ? (
        <p class={`${HINT_STYLE} mt-2`} data-water-estimate>
          For an estimate of the total and the sparge water, enter{" "}
          {estimate.missing.map((m) => (m === "liters" ? "the knockout volume" : "the malts on the Malt tab")).join(" and ")}.
        </p>
      ) : (
        <div class="mt-2 space-y-1 text-stone-700 dark:text-stone-300" data-water-estimate>
          <p data-estimate-total>
            <span class={TERM}>Total water</span> ≈ knockout volume + boil-off + grain absorption + losses ≈{" "}
            {oneDecimal(estimate.knockout)} L + {oneDecimal(estimate.boilOff)} L ({estimate.boilMinutes} min
            {estimate.boilAssumed ? " assumed" : ""}, ~10 %/h) + {oneDecimal(estimate.absorption)} L (~1 L/kg) + {estimate.losses} L ={" "}
            <span class={STRONG}>{oneDecimal(estimate.total)} L</span>
          </p>
          <p data-estimate-sparge>
            <span class={TERM}>Sparge water</span> ≈ total − mash water − top-up water
            {estimate.sparge === undefined ? (
              " (enter the mash water)"
            ) : (
              <>
                {" "}
                = <span class={STRONG}>{oneDecimal(estimate.sparge)} L</span>
              </>
            )}
          </p>
          <p>
            <span class={TERM}>Top-up water</span>: usually 0; only to dilute to the target gravity.
          </p>
        </div>
      )}
    </aside>
  );
}
