/**
 * The Overview tab (EDT-065, QE-55): the first tab, open when a recipe is opened. It holds the recipe's description,
 * the brewer's free text about it (app RCP-016), with as many lines as needed.
 */

import type { Problem } from "../validate";
import { withDescription, type Recipe } from "../model";
import { TextField } from "./fields";
import { FieldNotes, notesAt } from "./notes";
import { SECTION_TITLE_STYLE } from "./styles";

export function OverviewTab(props: { recipe: Recipe; problems: Problem[]; onChange: (recipe: Recipe) => void }) {
  const notes = notesAt({ problems: props.problems, warnings: [] }, "description");
  return (
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
  );
}
