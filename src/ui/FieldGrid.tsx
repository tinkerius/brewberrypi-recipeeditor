/**
 * Form fields (EDT-068, QE-60, QE-75), the same layout in every section: each row the field's label, the field with
 * its unit, an ⓘ that opens the field's info (its explanation, typical value and calculation, EDT-072) below the row,
 * and the field's errors and warnings beside it (EDT-062). The same column widths in every grid, so the fields line up
 * across sections and tabs. On a phone the notes go below the field.
 */

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { FieldNotes, type Note } from "./notes";
import { INFO_PANEL, InfoButton, InfoContent, type Info } from "./info";

const GRID =
  "grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[11rem_auto_1.5rem_1fr] [&_input]:max-w-full";

/** The grid of a section's fields. */
export function FieldGrid(props: { children: ComponentChildren; [data: `data-${string}`]: unknown }) {
  const { children, ...data } = props;
  return (
    <div class={GRID} {...data}>
      {children}
    </div>
  );
}

/**
 * One row: `field` is a NumberField or TextField (its label and its input, two cells of the grid); then the ⓘ of its
 * info and its notes; below, while open, the info.
 */
export function FieldRow(props: {
  /** The row's id, for its `data-field-row` and the info panel. */
  id: string;
  field: ComponentChildren;
  /** The ⓘ's label ("About: Mash water") and what it shows. */
  label: string;
  info: Info;
  notes: Note[];
}) {
  const [open, setOpen] = useState(false);
  const panel = `field-info-${props.id}`;
  return (
    <div class="contents" data-field-row={props.id}>
      {props.field}
      <span class="flex items-center">
        <InfoButton open={open} label={props.label} controls={panel} onClick={() => setOpen(!open)} />
      </span>
      <div class="col-span-3 sm:col-span-1" data-field-notes-cell>
        <FieldNotes notes={props.notes} />
      </div>
      {open && (
        <div id={panel} class={`col-span-full mb-2 ${INFO_PANEL}`} data-field-info={props.id}>
          <InfoContent info={props.info} />
        </div>
      )}
    </div>
  );
}
