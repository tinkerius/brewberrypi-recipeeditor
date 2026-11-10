# 09 — Acceptance Criteria

Automated criteria run with a fake browser storage, a fake Google Drive and no network. Each has a test whose name
starts with its ID (`NFR-031`). Criteria marked *manual* need a real Google account and are checked by hand before
a release that changes sign-in or Drive behaviour.

## 9.1 Recipe files

- `ACC-001` (FMT-004) For each case of a list of valid and invalid recipes (every goal type, missing and wrong
  fields, out-of-range values, Rest with only a name, unknown keys, old format, versions 0, 1, 2, 3, 4, `"1"`,
  mashing plans valid and invalid as in `FMT-004`), the editor's validation and the app's schema agree on valid /
  not valid; the editor names the goal and field.
- `ACC-002` (FMT-002) File names `BENIWEISS`, `WaterBoil`, `my-recipe_2` are accepted; ``, `with space`, `umlaut-ä`,
  `dot.json`, `../x` are refused.
- `ACC-003` (FMT-006) Each shipped recipe written by the editor equals its file without the `$schema` line; any
  recipe written and read again is the same; an empty recipe is written as `version`, `name`, `mashing_process`.
- `ACC-004` (FMT-003) A file without `version` or with `"version": 1` or `2` is read as version 3 with the same
  content, without a notice.
- `ACC-005` (FMT-003) A file with `goals` at the top level is read with the goals in `mashing_process`, with a notice
  saying so, and is valid.
- `ACC-006` (FMT-003) A file with `"version": 4` cannot be opened; the message names format version 4.
- `ACC-007` (FMT-005) A file with an `id` field and a goal field the type does not take is opened with both kept and
  both reported as problems.
- `ACC-008` (FMT-007) The samples are exactly `BENIWEISS` and `WaterBoil`, and both are valid.
- `ACC-009` (FMT-001, FMT-010, GUI-041) A complete recipe without goals is valid and can be downloaded from its
  menu; the editor shows that the app lists it but can't brew it.

## 9.2 Editing

- `ACC-010` (EDT-001, EDT-003, GUI-030) **New recipe** asks for the file name; after `Weizen` the recipe
  `Weizen.json` is open, empty and incomplete ("The recipe needs a name."), cannot be downloaded (Download in its
  menu says to fix it first), is "Not downloaded yet", and the editor has no file name field and no Download or
  Delete button (`GUI-031`).
- `ACC-011` (EDT-003) The name dialog refuses a name used by another recipe ("There already is a recipe …") and an
  invalid one, and creates nothing.
- `ACC-012` (EDT-006) Rename… of `Kept` to `Renamed` renames the draft in the list and in the browser storage. In
  Drive, renaming keeps the file's content, refuses a name used by another file, and tells whether the file had
  changed elsewhere.
- `ACC-013` (EDT-007, EDT-004) Duplicate… of `Kept` suggests `Kept-2` and opens the copy; free names continue
  `-2`, `-3`, ….
- `ACC-014` (EDT-008) Delete… asks, then removes the recipe; in Drive the file is moved to the trash and leaves the
  list.
- `ACC-015` (GUI-022) The recipe menu opens from the ⋯ button and with a right click on the row.
- `ACC-016` (EDT-013, EDT-014, EDT-011) New goals are valid where possible (CookWater needs its texts); a type change
  keeps the shared values; fields are in file order.
- `ACC-038` (EDT-012) Dragging the handle of goal 1 of 3 below goal 3 and releasing gives the order 2, 3, 1; while
  dragging, a drop line is shown; releasing at its own place or cancelling changes nothing. There are no move-up or
  move-down buttons.
- `ACC-039` (EDT-012) On the focused handle of goal 2, ArrowUp makes it goal 1 and the handle of the moved goal keeps
  the focus; ArrowUp on goal 1 changes nothing.
- `ACC-042` (EDT-010, GUI-030) Clicking the recipe name in the title opens a field; typing a new name and Enter shows
  it as the title and in the list; Escape after typing restores the old name; a new recipe opens with the field
  focused; there is no other name field.
- `ACC-043` (EDT-012, EDT-014, EDT-017) "+ Add goal" opens the type dialog; choosing Rest adds a Rest goal at the
  end; Cancel adds nothing. The pencil of an open HeatUp 40 °C goal opens the dialog with HeatUp marked; choosing Rest makes
  it a Rest of 40 °C. There is no type dropdown in the goal list.
- `ACC-044` (QE-24, EDT-011, EDT-017, FMT-004) No goal's type name of the file (`PourInBrewingWater`, `HeatUp`, …) is
  shown: not in the goal list, not in the type dialog, not in the problems ("A Heat Up goal needs a temperature.").
- `ACC-045` (DRV-006, GUI-031, QE-25) A Drive recipe without changes: Discard changes is disabled. After changing
  its name it is enabled; Discard changes and Cancel keep the change; Discard changes and confirming show the name
  saved in Drive again and "Saved in Google Drive", and the file in Drive is unchanged. A recipe not saved yet:
  disabled.
- `ACC-046` (QE-26, EDT-011, EDT-020, GUI-030) Each goal is one line without fields: HeatUp 40 °C reads "Heat Up
  to 40 °C", a Rest of 65 °C, 30 min named Maltoserast "Rest at 65 °C for 30 min — Maltoserast". Clicking a line
  opens that goal's fields and closes the one open before; clicking it again closes it. A goal added with + Add goal
  is open. A HeatUp without temperature reads "Heat Up to ? °C" and is marked; its "Goal 2" in the problem list opens
  it.
- `ACC-047` (QE-27, GUI-001, GUI-004) The top bar shows "BrewberryPi" as a link to https://brewberrypi.org/, "Recipe
  Editor" and Cloud Sync; the footer links to brewberrypi.org, the privacy policy, the terms and the source code.
- `ACC-048` (QE-28, GUI-032) Below the recipe's title is a tab list with the tabs **Mashing** and **Mash
  Process**, in this order, Mash Process selected; the Mash Process panel holds the goals and + Add goal; the problems are below the panel, not in it.
- `ACC-049` (QE-29, GUI-024, NFR-002) "Hide sidebar" collapses the recipe list to a strip with "Show sidebar" and
  New recipe, the recipe stays shown, and the browser remembers it (also after the page is shown again); with a
  recipe not downloaded, the strip shows "1 recipe not downloaded". Ctrl+B expands it again and the browser forgets
  it; Ctrl+B does nothing while a dialog is open.
- `ACC-056` (QE-30, GUI-002, GUI-020) Signed in, no notice above the columns says "Cloud Sync is on"; the recipe list
  says, below "Add untracked file from cloud storage", that the recipes are files in the Google Drive folder
  BrewberryPi/recipes.
- `ACC-057` (QE-31, DRV-005, SYN-003) Signed in with two recipes in Google Drive, both list rows show the recipe
  names without opening them. When the name in the recipe that is not open changes in Google Drive and a new recipe
  file is added there, after the next check of the changes both rows show the new names.
- `ACC-017` (BRW-004, DRV-010) A recipe has pending changes until it is downloaded (draft) or saved (Drive), and again
  after a change.
- `ACC-018` (EDT-016) On the first visit (new browser storage) the list holds the draft `BENIWEISS`; on a later visit
  with an empty list nothing is added. In Drive, the first sign-in (the folders are created) saves `BENIWEISS.json`;
  a later sign-in (the folders exist) adds nothing.
- `ACC-019` (GUI-020) The list is titled "My Recipes"; "New recipe" and "Upload recipe" come after the recipes;
  there is no "New from a sample recipe".
- `ACC-058` (QE-32, EDT-030, EDT-031, GUI-032) The Mashing tab is a table of the 9 rests of `EDT-031` in its
  order, each row with its name, the typical range ("60–65 °C" for the Maltose rest) in the Typical column after °C and
  the typical duration in the Typical column after min, an unticked check box and no fields (for a recipe without
  `mashing`); a ticked rest shows its fields in the °C and min columns, the typical values staying in theirs; and an ⓘ button "About this rest" that expands the rest's texts below the row (one at a time)
  and collapses them again; the goals are not shown in it.
- `ACC-059` (EDT-032, EDT-034, FMT-006) Ticking Mash-out and then Maltose rest plans them with 78 °C, 10 min and
  63 °C, 45 min; the recipe is complete, and the written file has `"mashing"` after `"mashing_process"` with
  `MaltoseRest` before `MashOut`, one rest per line, and reads back the same. Changing the Maltose rest's fields
  changes the plan; unticking both rests removes `mashing` from the recipe.
- `ACC-060` (EDT-033) A Maltose rest at 70 °C shows "⚠ Outside the typical range" after the typical range
  "60–65 °C" in the Typical column, and the field and the range are marked; the recipe stays complete and can be downloaded. At 60 °C and 65 °C there is no warning.
- `ACC-061` (EDT-035, FMT-004) A planned Maltose rest whose temperature is cleared is reported as "Mashing, Maltose
  rest: The Maltose rest needs a temperature." and its field is marked; clicking "Mashing, Maltose rest" from the
  Mash Process tab opens the Mashing tab. A file with an unknown rest in `mashing` is opened with it kept and
  reported.
- `ACC-062` (QE-33, EDT-036) The rest data holds every rest once, with its typical temperature inside its range and
  not above 78 °C, presets inside the typical duration, enzymes and texts; sorted by typical temperature
  the rests are 35, 35, 40, 45, 52, 63, 67, 72, 78 °C (pre-mash before acid rest); rests whose ranges overlap or
  touch never share a lane; labels spread by the ladder keep their gap and stay inside the chart.
- `ACC-063` (EDT-039) Pre-mash 35 °C 15 min → Maltose rest 63 °C 45 min → Saccharification rest 72 °C 30 min →
  Mash-out 78 °C 5 min at 1 °C/min gives the step profile 0/35, 15/35, 43/63, 88/63, 97/72, 127/72, 133/78,
  138/78 (minute/°C): 95 min of rests, 43 min heating, 138 min in total, and no warnings; at 2 °C/min the heating
  takes 21.5 min. A start temperature of 20 °C before a maltose rest adds 43 min. A plan's steps are taken in table
  order, without rests whose values are not valid numbers.
- `ACC-064` (EDT-038) Warnings for: Maltose rest 66 °C then Saccharification rest 64 °C (lower than the step
  before); Mash-out at 80 °C (above 78 °C); Protein rest and Maltose rest only (no conversion); Maltose rest 90 min
  and Saccharification rest 10 min (outside their typical durations). None for a Combined rest of 60 min, or a
  pre-mash of 240 min. The warnings are listed below the ladder and the recipe stays complete.
- `ACC-065` (EDT-036, EDT-037) The ladder is above the table; it has a band and a label for each of the 9 rests,
  sorted by typical temperature, each label with its short name and typical temperature only (no effect), and
  a tooltip with its enzymes; the acid rest says "(obsolete)"; the limit reads "max 78 °C". Without planned rests it says "No
  rests planned yet." and "Tick rests below to draw the schedule." Clicking the Protein rest in the ladder opens its
  texts in the table.
- `ACC-066` (EDT-039, EDT-040) Planning the steps of `ACC-063` in the table shows "Total mash time 2 h 18 min: 1 h
  35 min of rests, 43 min heating at 1 °C/min." and the profile; a heating rate of 2 shows "Total mash time 1 h 57
  min: 1 h 35 min of rests, 22 min heating at 2 °C/min."

## 9.3 Browser drafts

- `ACC-020` (BRW-001) A draft stored, then the store opened again (a reload), gives the same draft; it can be
  deleted.
- `ACC-021` (BRW-002, BRW-003) The banner says "only stored in this browser and can be lost" when the storage works
  and "only kept in this tab" when there is none; the store reports whether the browser keeps the drafts.
- `ACC-022` (BRW-002) Without IndexedDB, or when it fails to open, drafts are kept in memory.
- `ACC-023` (BRW-004) A draft kept in the browser is listed and marked "not downloaded".

## 9.4 Google Drive

- `ACC-030` (DRV-003) After sign-in the folders `BrewberryPi` and `recipes` (inside it) exist with their markers; a
  second sign-in finds them and creates nothing.
- `ACC-031` (DRV-005, DRV-006) A saved recipe is listed and read back unchanged; other files in the folder are not
  listed.
- `ACC-032` (DRV-006) A second file with the same name is refused, also when saving under a new name.
- `ACC-033` (DRV-007) Saving a file changed in Drive since it was opened is refused as a conflict; overwriting
  succeeds.
- `ACC-034` (DRV-009) A picked file in the recipes folder is listed as it is; one from elsewhere is copied in under a
  free name.
- `ACC-035` (DRV-002) An "unauthorised" answer renews the token once and repeats the request; other errors are
  reported.
- `ACC-037` (QE-18, GUI-001, BRW-003) With Cloud Sync off, the top bar shows "Cloud Sync" next to **Sign in with
  Google**, the banner starts with "Cloud Sync is off", and no text says "Drive" without "Google".
- `ACC-036` (DRV-011, DRV-013) A valid stored token is used by a new tab without Google's window; a (nearly) expired
  or unreadable one is not; a token renewed by another tab is taken over; sign-out removes it; a token that no
  longer works is removed; without storage the token stays in the tab.

## 9.5 Synchronisation

- `ACC-040` (SYN-002) The changes feed reports a new file in the recipes folder (also on a later page of the feed),
  a change, trashing or removal of a listed recipe, and nothing for files elsewhere; a refused feed position starts
  the feed again and counts as a change.
- `ACC-041` (SYN-003) Merging the list: new files are added; unchanged recipes stay; deleted ones are dropped, with
  pending changes kept as not saved; renamed or changed unopened recipes follow at once, opened ones are read again;
  recipes with pending changes are left to the save check; recipes not saved yet stay.

## 9.6 Manual (real Google account)

- `ACC-050` *manual* (DRV-001, GUI-010) Sign-in shows Google's consent with the app name and only "files you use with
  this app"; afterwards `BrewberryPi/recipes` exists in the Drive.
- `ACC-051` *manual* (DRV-006) A saved recipe appears in the Drive folder; downloaded and copied into a BrewberryPi's
  recipe folder, the app lists it.
- `ACC-052` *manual* (SYN-002) A recipe edited on another device appears on the first within about 10 s; a file
  deleted at drive.google.com leaves the list with the notice.
- `ACC-053` *manual* (DRV-009) A recipe file dropped into the folder at drive.google.com appears after "Add
  untracked file from cloud storage", which is shown as a link (GUI-023).
- `ACC-054` *manual* (DRV-011, DRV-013) A second tab is signed in at once; signing out in it signs out the first.
- `ACC-055` *manual* (QE-27) Next to brewberrypi.org, the editor's top bar, content width, page background (with the
  grid), cards, buttons, titles and footer look the same; in dark mode the page is dark and readable.
