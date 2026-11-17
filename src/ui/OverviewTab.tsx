/**
 * The Overview tab (EDT-065, QE-55): the first tab, open when a recipe is opened. It holds the recipe's description,
 * the brewer's free text about it (app RCP-016), with as many lines as needed; below it the brewing time with the
 * brew-day timeline (EDT-077, EDT-078, QE-85..QE-87) and the list of everything the brew needs (EDT-076), all computed,
 * never stored.
 */

import { useState } from "preact/hooks";
import type { Problem } from "../validate";
import { withDescription, type Recipe } from "../model";
import { DEFAULT_HEATING_RATE, formatMinutes } from "../mashSchedule";
import { brewDayTimeline, brewingTime, ingredientList, type ListGroup, type ListTab } from "../overview";
import { BrewDayTimeline } from "./BrewDayTimeline";
import { TextField } from "./fields";
import { InfoButton, InfoContent, INFO_PANEL } from "./info";
import { FieldNotes, notesAt } from "./notes";
import { HINT_STYLE, LINK_STYLE, SECTION_TITLE_STYLE } from "./styles";

/** The tabs the Overview links to. */
export type OverviewLinkTab = ListTab | "mashing";

const TAB_NAMES: Record<OverviewLinkTab, string> = {
  malts: "Malt tab",
  mashing: "Mashing tab",
  hops: "Boiling tab",
  water: "Water tab",
  fermentation: "Fermentation tab",
};

/** One group of the ingredient list: its heading (a link to the tab it is entered on), its lines and its total. */
function Group(props: { group: ListGroup; onTab?: (tab: OverviewLinkTab) => void }) {
  const { group } = props;
  const id = `overview-${group.id}`;
  return (
    <div class="rounded-lg p-3 ring-1 ring-line dark:ring-white/10" data-overview-group={group.id}>
      <h4 id={id} class="mb-1 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink dark:text-ink-light">
        {group.title}
        {props.onTab && (
          <button type="button" class={`${LINK_STYLE} text-xs! font-medium!`} data-tab-link={group.tab} onClick={() => props.onTab!(group.tab)}>
            {TAB_NAMES[group.tab]}
          </button>
        )}
      </h4>
      <dl class="grid grid-cols-[1fr_auto] gap-y-1 text-sm" aria-labelledby={id}>
        {group.lines.map((line, i) => (
          <div key={i} class="contents" data-overview-line>
            <dt class="min-w-0 text-stone-700 dark:text-stone-300">
              <span data-overview-name>{line.name}</span>
              {line.note && (
                <span class="ml-1.5 text-xs text-stone-500 dark:text-stone-400" data-overview-note>
                  {line.note}
                </span>
              )}
            </dt>
            <dd class="pl-4 text-right tabular-nums text-ink dark:text-ink-light" data-overview-amount>
              {line.amount}
            </dd>
          </div>
        ))}
        {group.total !== undefined && (
          <div class="contents" data-overview-total>
            <dt class="border-t border-line pt-1 font-medium text-ink dark:border-white/10 dark:text-ink-light">Total</dt>
            <dd class="border-t border-line pt-1 pl-4 text-right font-semibold tabular-nums text-ink dark:border-white/10 dark:text-ink-light">
              {group.total}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function OverviewTab(props: {
  recipe: Recipe;
  problems: Problem[];
  onChange: (recipe: Recipe) => void;
  onTab?: (tab: OverviewLinkTab) => void;
}) {
  const notes = notesAt({ problems: props.problems, warnings: [] }, "description");
  const groups = ingredientList(props.recipe);
  const time = brewingTime(props.recipe);
  const timeline = brewDayTimeline(props.recipe);
  const [about, setAbout] = useState(false);
  // What to enter while a part of the brewing time is missing.
  const missing = [
    ...(time.mash ? [] : ["Plan the rests on the Mashing tab."]),
    ...(time.boil !== undefined ? [] : ["Enter the cooking times on the Boiling tab."]),
  ];
  return (
    <>
      <section aria-labelledby="description-title">
        <h3 id="description-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
          Description
        </h3>
        <div class="[&_textarea]:min-h-40 [&_textarea]:resize-y" data-description>
          <TextField
            label="Description"
            compact
            multiline
            rows={8}
            placeholder="What is this beer? Style, ideas, notes for the brew day …"
            value={props.recipe.description}
            invalid={notes.length > 0}
            onChange={(text) => props.onChange(withDescription(props.recipe, text))}
          />
        </div>
        <FieldNotes notes={notes} class="mt-1" />
      </section>
      <section class="mt-6" aria-labelledby="brewing-time-title" data-brewing-time>
        <h3 id="brewing-time-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
          Brewing time
        </h3>
        {/* The overall time (EDT-077, QE-88), then the timeline (EDT-078). */}
        <div class="mb-3" data-brew-total-line>
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink dark:text-ink-light">
            <span class="font-medium">Total brewing time:</span>
            <span class="text-lg font-semibold tabular-nums" data-brew-time>
              {time.total !== undefined ? formatMinutes(time.total) : "–"}
            </span>
            <InfoButton open={about} label="About: Total brewing time" controls="brew-time-info" onClick={() => setAbout(!about)} />
            {missing.length > 0 && (
              <span class={HINT_STYLE} data-brew-time-missing>
                {missing.join(" ")}
              </span>
            )}
          </p>
          {about && (
            <div id="brew-time-info" class={`mt-2 ${INFO_PANEL}`} data-brew-time-info>
              <InfoContent
                info={{
                  explanation:
                    "The mashing and the boil: the mash schedule of the Mashing tab (heating to each rest and the rests) and the " +
                    "total boil time of the Boil Schedule. Not counted: heating the water to the mash-in, lautering, heating to the " +
                    "boil, the whirlpool and cooling.",
                  calculation: `Heating at ${DEFAULT_HEATING_RATE} °C/min.`,
                }}
              />
            </div>
          )}
        </div>
        {timeline && <BrewDayTimeline timeline={timeline} />}
      </section>
      <section class="mt-6" aria-labelledby="overview-ingredients-title" data-overview-ingredients>
        <h3 id="overview-ingredients-title" class={`${SECTION_TITLE_STYLE} mb-2`}>
          Ingredients
        </h3>
        {groups.length === 0 ? (
          <p class={HINT_STYLE}>No ingredients yet.</p>
        ) : (
          <div class="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Group key={group.id} group={group} onTab={props.onTab} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
