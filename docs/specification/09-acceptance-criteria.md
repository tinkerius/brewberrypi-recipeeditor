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
- `ACC-048` (QE-28, QE-34, QE-35, GUI-032) Below the recipe's title is a tab list with the tabs **Malt**, **Hops**,
  **Water**, **Mashing** and **Mash Process**, in this order, Malt selected (it shows the malt table); the Mash Process panel holds the goals and, as the list's last row, + Add goal; the problems are below the panel, not in it.
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
- `ACC-058` (QE-32, EDT-030, EDT-031, GUI-032) The Mashing tab has, below the heading "Rests", a table of the 9 rests of `EDT-031` in its
  order, each row with its name, the typical range ("60–65 °C" for the Maltose rest) in the Typical column after °C and
  the typical duration in the Typical column after min, an unticked check box and no fields (for a recipe without
  `mashing`); a ticked rest shows its fields in the °C and min columns, the typical values staying in theirs; and an ⓘ button "About this rest" that expands the rest's texts below the row (one at a time)
  and collapses them again; the goals are not shown in it.
- `ACC-059` (EDT-032, EDT-034, FMT-006) Ticking Mash-out and then Maltose rest plans them with 78 °C, 10 min and
  63 °C, 45 min (a pre-mash with 25 °C, 20 min); the recipe is complete, and the written file has `"mashing"` after `"mashing_process"` with
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
  the rests are 25, 35, 40, 45, 52, 63, 67, 72, 78 °C; rests whose ranges overlap or
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
- `ACC-065` (EDT-036, EDT-037) The ladder is above the table, below the heading "Temperature Ladder"; it has a band and a label for each of the 9 rests,
  sorted by typical temperature, each label with its short name and typical temperature only (no effect), and
  a tooltip with its enzymes; the acid rest says "(obsolete)"; the limit reads "max 78 °C". Planning the pre-mash at 30 °C shows "Pre-mash 30 °C" with its tick
  at 30 °C and "Planned: 30 °C for 20 min" in its tooltip; unticking it shows "Pre-mash 25 °C" again. Without planned rests it says "No
  rests planned yet." and "Tick rests below to draw the schedule." Clicking the Protein rest in the ladder opens its
  texts in the table.
- `ACC-066` (EDT-039, EDT-040) Planning the steps of `ACC-063` in the table shows "Total mash time 2 h 18 min: 1 h
  35 min of rests, 43 min heating at 1 °C/min." and the profile; a heating rate of 2 shows "Total mash time 1 h 57
  min: 1 h 35 min of rests, 22 min heating at 2 °C/min."
- `ACC-067` (QE-34, QE-35, EDT-041, EDT-042) The Malt tab has a table with Name, g, EBC, % and a Total line, the
  Hops tab one with Name, g, α %, min, % and a Total line, saying "No malt yet." / "No hop yet." for a recipe without `ingredients`; + Add malt / + Add
  hop is the table's last row before the Total line, and adds an empty row above it whose name field has the focus; ✕ removes a row; removing the last row of both tables removes
  `ingredients` from the recipe.
- `ACC-068` (EDT-043) Malts Pilsner malt 4500 g and Munich malt 500 g show 90 % and 10 % and the total 5000 g, 100 %;
  three hops of 10 g each show 33.3 % each and 30 g; a row without an amount shows "–" and doesn't count.
- `ACC-069` (EDT-044, EDT-045, FMT-004) A new row is reported as "Malt 1: Malt 1 needs a name." and
  "… needs an amount in grams.", with its fields marked; 12.5 g is "Malt 1: the amount must be a whole number of
  grams.", 0 g "… must be at least 1 g."; clicking "Malt 1" from the Mash Process tab opens the
  Malt tab, "Hop 1" the Hops tab. A name and 4500 g make the recipe complete.
- `ACC-070` (FMT-006, EDT-042) Two malts and a hop are written as `"ingredients"` after `"mashing"` (or after
  `"mashing_process"`), `malts` before `hops`, one entry per line in the brewer's order
  (`{ "name": "Pilsner malt", "grams": 4500 }`), without shares; the file reads back the same.
- `ACC-071` (EDT-046) Malts Pilsner malt, Munich malt, Caramunich: dragging the first handle below the third shows a
  drop line and gives Munich malt, Caramunich, Pilsner malt, with the shares moved along; ArrowUp on the third handle
  moves Pilsner malt up one, its handle keeping the focus; the file has the new order.
- `ACC-072` (EDT-047) Pilsner malt 4500 g, Munich malt 500 g and a malt without an amount: the donut has two slices
  in the chart colours 1 and 2 with the tooltips "Pilsner malt: 4500 g, 90 %" and "Munich malt: 500 g, 10 %", the
  legend Pilsner malt 90 %, Munich malt 10 %, and 5000 g in its middle; each row's swatch has its slice's colour; a
  9th row's slice is "other". No donut without amounts.
- `ACC-073` (EDT-048, EDT-050) The beer colour is "–" with "Add malts with their amounts."; with Pilsner malt 4500 g
  3.5 EBC and Munich malt 500 g without EBC, "Enter the EBC of malt 2 and the knockout volume on the Water tab."
  (the link opens the Water tab; the Malt tab has no volume field); with Munich malt 15 EBC and 20 L on the Water tab
  it is "9 EBC" with the swatch #FFBF42 and the hint names "the knockout volume (20 L, Water tab)". An EBC of −1 is "Malt 2: the colour must be a number of
  at least 0 EBC."
- `ACC-074` (EDT-049, EDT-050) The bitterness of Hallertauer Tradition 30 g, 5.5 %, 60 min in 20 l at 12.6 °P is
  "19 IBU"; until the boil time, volume and gravity are entered it is "–" with "Enter the alpha acid and boil time
  of hop 1 and the knockout volume and the original gravity on the Water tab."; a hop of 0 min adds nothing. 101 % and 2.5 min are
  problems.
- `ACC-075` (EDT-050, EDT-045, FMT-006) The Malt and Hops tabs have no batch fields; the knockout volume and the
  original gravity are entered on the Water tab; 20 l and 12.6 °P are written as `"batch": { "liters": 20, "plato": 12.6 }`; 0 l and
  41 °P are problems whose entries open the Water tab; clearing both removes `batch`.
- `ACC-076` (EDT-041, QE-36) The Malt tab has the heading Malt before its table; the Hops tab Hops before its table
  and Hop Schedule after it.
- `ACC-077` (EDT-054) Hops Saaz 10 g 0 min, Hallertauer Tradition 30 g 60 min, Tettnanger 20 g 10 min and Cascade
  15 g without boil time: the schedule lists 60 min Hallertauer Tradition 30 g, 10 min Tettnanger 20 g, flame-out
  Saaz 10 g, with dots from left to right in the hops' donut colours and tooltips ("… 60 min before the end of the
  boil", "Saaz: 10 g, flame-out"), and says "No boil time yet: hop 4."; without boil times it asks for them.
- `ACC-078` (EDT-051, EDT-053, FMT-006) The Water tab has the heading Water and the fields Mash water, Sparge water,
  Top-up water and Knockout volume (L) with their hints (then the Gravity fields, `ACC-081`); 16, 14 and 2 are written as
  `"water": { "mash": 16, "sparge": 14, "top_up": 2 }`; −1 is a problem whose entry opens the Water tab; clearing
  all three removes `water`.
- `ACC-079` (EDT-052, EDT-050) With 5000 g of malt: total water "–", then 14 L, then with 16 L mash and 2.5 L
  top-up water 32.5 L and a mash thickness of 3.2 L/kg (typical 2.5–4 L/kg); "Enter the mash water." before, and
  "Enter the malts on the Malt tab." without malts. With a knockout volume of 20 L the Malt tab no longer asks for it.
- `ACC-080` (EDT-055) At 9 EBC the colour scale has the styles Pils, Pale Ale, Märzen, Dunkel, Stout, the marker
  between Pils and Pale Ale and "In the range of: Helles, Weissbier."; with roasted barley above 80 EBC the marker
  is at the scale's end and it says "Darker than a typical stout."; no scale without a colour.
- `ACC-081` (EDT-057, EDT-045, FMT-006) The Water tab has the headings Water and Gravity; Gravity has Original
  gravity (target) and Final gravity (°P). The alcohol is "–" with "Enter the original gravity and the final
  gravity."; 12 °P and 2.5 °P give 5.1 % vol and 79 % apparent attenuation and are written as
  `"batch": { "plato": 12, "final_plato": 2.5 }`; a final gravity of 12 says "The final gravity must be below the
  original gravity."; 41 is a problem whose entry opens the Water tab.
- `ACC-082` (EDT-056) Hallertauer Tradition 30 g, 5.5 %, 60 min, 20 L, 12.6 °P: the bitterness scale has Weissbier,
  Helles, Pils, Pale Ale, IPA and says "In the range of: Helles, Märzen, Dunkel.", and "BU:GU 0.37: balanced
  (bitterness against the original gravity)."; 200 g give 126 IBU, "More bitter than a typical IPA." and "very
  bitter". No scale without a bitterness.
- `ACC-083` (EDT-058) Pilsner malt 3.5 EBC and chocolate malt 900 EBC show swatches #FFD878 and #36080A next to their
  EBC fields (tooltip "About the colour of 3.5 EBC"); a malt without EBC shows none.

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
