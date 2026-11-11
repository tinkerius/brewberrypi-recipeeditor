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
  `Weizen.json` is open (the file name in the list, not in its header), empty and incomplete ("The recipe needs a name."), cannot be downloaded (Download in its
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
- `ACC-048` (QE-28, QE-34, QE-35, QE-55, QE-56, GUI-032) Below the recipe's title is a tab list with the tabs
  **Overview**, **Malt**, **Mashing**, **Boiling**, **Water**, **Fermentation** and **Mash Process**, in this order,
  Overview selected (it shows the description); Malt shows the malt table; the Mash Process panel holds the goals and, as the list's last row, + Add goal; the problems are on the Overview tab only (`QE-59`), not on the Mash Process tab.
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
- `ACC-059` (EDT-032, EDT-034, FMT-006, QE-63) Ticking Mash-out and then Maltose rest plans them with empty fields (a
  pre-mash too), reported as "The Maltose rest needs a temperature." and "The Mash-out needs minutes."; with 78 °C,
  10 min and 63 °C, 50 min entered the recipe is complete, and the written file has `"mashing"` after `"mashing_process"` with
  `MaltoseRest` before `MashOut`, one rest per line, and reads back the same. Changing the Maltose rest's fields
  changes the plan; unticking both rests removes `mashing` from the recipe.
- `ACC-060` (EDT-033) A Maltose rest at 70 °C shows "⚠ Outside the typical range" after the typical range
  "60–65 °C" in the Typical column, and the field and the range are marked; the recipe stays complete and can be downloaded. At 60 °C and 65 °C there is no warning.
- `ACC-061` (EDT-035, FMT-004) A planned Maltose rest whose temperature is cleared is reported as "Mashing, Maltose
  rest: The Maltose rest needs a temperature." and its field is marked; clicking "Mashing, Maltose rest" from the
  Mash Process tab opens the Mashing tab. A file with an unknown rest in `mashing` is opened with it kept and
  reported.
- `ACC-062` (QE-33, EDT-036) The rest data holds every rest once, with its typical temperature inside its range and
  not above 78 °C, enzymes and texts; sorted by typical temperature
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
  rests planned yet." and "Tick rests below to draw the schedule." (with a ticked rest without values "Enter the
  temperature and duration of the ticked rests." and "Enter their temperature and duration to draw the schedule.") Clicking the Protein rest in the ladder opens its
  texts in the table.
- `ACC-066` (EDT-039, EDT-040) Planning the steps of `ACC-063` in the table shows "Total mash time 2 h 18 min: 1 h
  35 min of rests, 43 min heating at 1 °C/min." and the profile; a heating rate of 2 shows "Total mash time 1 h 57
  min: 1 h 35 min of rests, 22 min heating at 2 °C/min."
- `ACC-067` (QE-34, QE-35, EDT-041, EDT-042) The Malt tab has a table with Name, EBC, Absolute amount (g), Relative amount (%)
  and a Total line, the Boiling tab one with Name, α %, Additions (cooking time · amount), Absolute amount (g) and
  a Total line, saying "No malt yet." / "No hop yet." for a recipe without `ingredients`; + Add malt / + Add
  hop is the table's last row before the Total line, and adds an empty row above it whose name field has the focus; ✕ removes a row; removing the last row of both tables removes
  `ingredients` from the recipe.
- `ACC-068` (EDT-043) Malts Pilsner malt 4500 g and Munich malt 500 g show 90 % and 10 % and the total 5000 g, 100 %;
  three hops of 10 g each show 33.3 % each in the donut's legend and the Total 30 g; a malt without an amount shows
  "–", and a row without an amount doesn't count.
- `ACC-069` (EDT-044, EDT-045, FMT-004) A new row is reported as "Malt 1: Malt 1 needs a name." and
  "… needs an amount in grams.", with its fields marked; 12.5 g is "Malt 1: the amount must be a whole number of
  grams.", 0 g "… must be at least 1 g."; clicking "Malt 1" from the Mash Process tab opens the
  Malt tab, "Hop 1" the Boiling tab. A name and 4500 g make the recipe complete.
- `ACC-070` (FMT-006, EDT-042) Two malts and a hop are written as `"ingredients"` after `"mashing"` (or after
  `"mashing_process"`), `malts` before `hops`, one entry per line in the brewer's order
  (`{ "name": "Pilsner malt", "grams": 4500 }`, `{ "name": "Hallertauer Tradition", "alpha": 5.5, "additions": [ { "minutes":
  60, "grams": 30 } ] }`), without shares; the file reads back the same.
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
  it is "9 EBC" with the swatch #FFBF42, no hint, and an ⓘ button that shows "Morey's formula, from each malt's EBC
  and the knockout volume (20 L, Water tab)." (the bitterness likewise, `ACC-074`). An EBC of −1 is "Malt 2: the colour must be a number of
  at least 0 EBC."
- `ACC-074` (EDT-049, EDT-050) The bitterness of Hallertauer Tradition 30 g, 5.5 %, 60 min in 20 l at 12.6 °P is
  "19 IBU"; until the boil time, volume and gravity are entered it is "–" with "Enter the alpha acid and boil time
  of hop 1 and the knockout volume on the Water tab and the original gravity on the Fermentation tab."; a hop of 0 min adds nothing. 101 % and 2.5 min are
  problems.
- `ACC-075` (EDT-050, EDT-045, FMT-006) The Malt and Boiling tabs have no batch fields; the knockout volume is
  entered on the Water tab, the original gravity on the Fermentation tab; 20 l and 12.6 °P are written as
  `"batch": { "liters": 20, "plato": 12.6 }`; 0 l and 41 °P are problems whose entries open the Water and the
  Fermentation tab; clearing both removes `batch`.
- `ACC-076` (EDT-041, QE-36, QE-42) The Malt tab has the headings Malt Overview (above the donut and figure) and Malt
  (above the table); the Boiling tab Hops Overview, Boil Schedule and Boil Ingredients, in this order (`QE-43`).
- `ACC-077` (EDT-054, QE-47, QE-48, QE-51) Hops Saaz 10 g 0 min, Hallertauer Tradition 30 g 60 min, Tettnanger 20 g 10 min and Cascade
  15 g without cooking time: "Total boil time: 60 min"; the table (Add at, Ingredient, Amount, the cooking time on the
  time axis) lists 0 min (start) Hallertauer Tradition 30 g 60 min, 50 min Tettnanger 20 g 10 min, 60 min
  (flame-out) Saaz 10 g 0 min; the bars start at 0 %, at 50/60 of the axis and as a mark at its end, from "start" to
  "end", in the hops' greens (their donut colours; a 4th hop's in the muted tone), with tooltips ("…, add at 0 min
  (start), cooks 60 min"); it says "No cooking time yet: hop 4."; without cooking times it asks for them.
- `ACC-078` (EDT-051, EDT-053, FMT-006) The Water tab has the heading Water and the fields Mash water, Sparge water,
  Top-up water and Knockout volume (target) (L) with their hints, and no gravity (`ACC-081`); 16, 14 and 2 are written as
  `"water": { "mash": 16, "sparge": 14, "top_up": 2 }`; −1 is a problem whose entry opens the Water tab; clearing
  all three removes `water`.
- `ACC-079` (EDT-052, EDT-050) With 5000 g of malt: total water "–", then 14 L, then with 16 L mash and 2.5 L
  top-up water 32.5 L and a mash thickness of 3.2 L/kg (typical 2.5–5 L/kg); "Enter the mash water." before, and
  "Enter the malts on the Malt tab." without malts. With a knockout volume of 20 L the Malt tab no longer asks for it.
- `ACC-080` (EDT-055) At 9 EBC the colour scale has the styles Pils, Pale Ale, Märzen, Dunkel, Stout, the marker
  between Pils and Pale Ale, the label "9 EBC on a scale from 0 to 80 EBC, like Helles, Weissbier" and no line
  naming the styles; with roasted barley above 80 EBC the marker is at the scale's end; no scale without a colour.
- `ACC-081` (EDT-057, EDT-045, FMT-006, QE-56) The Water tab has only the heading Water; the Fermentation tab the
  headings Gravity, Yeast and Carbonation; Gravity has Original
  gravity (target) and Final gravity (°P). The alcohol is "–" with "Enter the original gravity and the final
  gravity."; 12 °P and 2.5 °P give 5.1 % vol and 79 % apparent attenuation and are written as
  `"batch": { "plato": 12, "final_plato": 2.5 }`; a final gravity of 12 says "The final gravity must be below the
  original gravity."; 41 is a problem whose entry opens the Fermentation tab.
- `ACC-082` (EDT-056) Hallertauer Tradition 30 g, 5.5 %, 60 min, 20 L, 12.6 °P: the bitterness scale has Weissbier,
  Helles, Pils, Pale Ale, IPA and no "In the range of" line (its label still names Helles, Märzen, Dunkel), and the
  heading line "BU:GU: 0.37 balanced"; 200 g give 126 IBU, the marker at the scale's end and "very bitter". No scale
  without a bitterness.
- `ACC-083` (EDT-058) Pilsner malt 3.5 EBC and chocolate malt 900 EBC show swatches #FFD878 and #36080A next to their
  EBC fields (tooltip "About the colour of 3.5 EBC"); a malt without EBC shows none.
- `ACC-084` (EDT-059) At BU:GU 0.37 the balance bar has the bands malty, balanced, bitter, very bitter, the limits
  0, 0.35, 0.55, 0.80, 1.0+, "balanced" in bold and the marker in the balanced band's malty half; at 126 IBU "very
  bitter" is bold and the marker at the end. No bar without BU:GU.
- `ACC-085` (EDT-060, QE-42, QE-44) On the Boiling tab (so named), with Hallertauer Tradition 30 g 5.5 % 60 min (19 IBU):
  below the Hops table a table Other additions (heading "Other additions — not in the shares or the
  bitterness"; Name, Additions (cooking time · amount), Absolute amount (g); "No other addition yet."); + Add other addition adds a
  row with the focus on its name and no α field; Irish Moss 10 g 15 min leaves 19 IBU, the hop's 100 %, one donut slice
  and the hops' "Total 30 g"; its own table's Total is 10 g, and there is no total of both; the schedule adds it at 45 min with a jar icon in the first violet (the hop with a hop cone in the first green, also its donut slice's colour, "Hallertauer Tradition (5.5 % α)"); the file has
  `"others": [ { "name": "Irish Moss", "additions": [ { "minutes": 15, "grams": 10 } ] } ]` after `hops`; without grams it is
  "Other addition 1: Other addition 1, addition 1 needs an amount in grams.", whose entry opens the Boiling tab.
- `ACC-086` (EDT-061, QE-49) Hallertauer Tradition 5.5 % with the additions 60 min 20 g and 10 min 10 g, and Saaz
  10 g 0 min: the hop's absolute amount is 30 g and its share 75 %, the Total 40 g; the bitterness counts both
  additions (15 IBU in 20 L at 12.6 °P); the Boil Schedule has three entries (0 min (start) Hallertauer Tradition
  60 min 20 g, 50 min Hallertauer Tradition 10 min 10 g, 60 min (flame-out) Saaz 0 min 10 g), both of the hop's in its
  green; the file has `"additions": [ { "minutes": 60, "grams": 20 }, { "minutes": 10, "grams": 10 } ]`; the ✕ of an
  addition shows only while there are two, and removing one leaves 20 g; an addition without an amount is
  "Hop 1, addition 2 needs an amount in grams."
- `ACC-087` (EDT-054, QE-51) Hallertauer 60 min, Magnum 60 min, Bramling 10 min and Irish Moss 10 min: two groups,
  "0 min (start)" and "50 min", each "2×" on its first row only (the second row reads it out to screen readers);
  each row has its own bar, those of a group starting together; "60 min" is on its bar, "10 min" next to its shorter
  one; a single addition at a time has no count.
- `ACC-088` (EDT-043, QE-52) With four hops and an other addition, each row's Name cell starts with its icon: hop
  cones in the first, second and third green and the muted tone (the first also the donut slice's colour), a jar in
  the first violet; the hops' table has no Relative amount column; a malt row has no icon and keeps its share.
- `ACC-089` (FMT-003, EDT-061, QE-53) A hop `{ "name": "Hallertauer", "grams": 15, "alpha": 5, "minutes": 60 }` is read
  as `{ "name": "Hallertauer", "alpha": 5, "additions": [ { "minutes": 60, "grams": 15 } ] }`, one with additions
  gets its own as the first addition unless the same one is there, another addition likewise, with the notice
  "Converted: hop 1 "Hallertauer": its own amount and cooking time are moved into its additions."; the result is
  valid. A kept draft so converted shows 114 g for 15 g and 99 g, then 20 g after the second becomes 5 g.
- `ACC-090` (EDT-062, QE-54) A hop Hallertauer 20 g, 25 %, 120 min with a second, empty addition: the line below its
  row has "⊘ Addition 2 needs an amount in grams." in red, then "⚠ α typically 2–20 %" and "⚠ Addition 1: typically
  up to 90 min" in amber; the empty amount has a red ring, α and the cooking time amber ones; fixed, the line goes.
  An original gravity of 25 °P shows its warning under the field's hint, 41 °P its error instead. A recipe without a
  name shows "⊘ The recipe needs a name." under the title.
- `ACC-091` (EDT-063) No tab has a badge for a valid recipe in its typical ranges; a hop without an amount and with
  25 % alpha acid gives Boiling a red "1" and "⚠ 1" ("(1 error, 1 warning)"), the Malt tab none; an original
  gravity of 25 °P and a final gravity of 0.5 °P give Water "⚠ 3" (both gravities and the attenuation); fixed, the
  badge goes.
- `ACC-092` (EDT-020, QE-59) On the Overview tab only, under the heading Status (none on the Boiling tab), the errors are listed under "⊘ Incomplete — fix these before saving or downloading:", the
  warnings apart under "⚠ Warnings — outside the typical range; the recipe stays valid:"; with only warnings the
  recipe is "Complete", the warnings stay listed, their entries open their tab, and it can be downloaded.
- `ACC-093` (EDT-064, EDT-033, EDT-038) Warnings outside, none at the limits: mash thickness 2.5 and 4 L/kg none,
  6.3 L/kg at the mash water; original gravity 7 and 22 °P none, 6.5 and 25 °P; final gravity 1 and 5 °P none, 6 °P;
  attenuation 76 % none, 93 % at the final gravity (mash thickness 5 L/kg none, `QE-58`); alpha acid 2 and 20 % none, 1.5 and 25 %; a hop addition of 90 min
  none, 120 min; another addition's 120 min none; a Maltose rest at 70 °C for 90 min at both fields; a gravity of 41 °P
  or alpha acid of 101 % is an error and no warning; a CO₂ target of 3.5 and 7.5 g/L none, 3 and 8 g/L, 0 an error;
  gypsum 3 g/10 L and acid malt 5 % none, 3.5 g/10 L and 6 %; for 9 EBC a treated residual alkalinity of 2 °dH none,
  2.5 °dH a warning, none without a beer colour;
  the recipe stays valid.
- `ACC-094` (EDT-065, GUI-032, QE-55) A recipe opens on the Overview tab, the first one, with the heading
  Description and a box of eight lines; "A cloudy wheat beer." and "Banana and clove." on two lines are written as
  `"description": "A cloudy wheat beer.\nBanana and clove."` right after `"name"`; cleared, `description` leaves
  the file. A description that is not text is "Description: The description must be text.", with the Overview tab's
  error count 1.
- `ACC-095` (EDT-066, QE-57, FMT-006) On the Fermentation tab a yeast amount of 11.5 g alone is "Yeast: The yeast
  needs a name." (also at the field); with the name Fermentis WB-06 and a CO₂ target of 6.5 g/L the file ends with
  `"fermentation": { "yeast": { "name": "Fermentis WB-06", "grams": 11.5 }, "co2": 6.5 }` after `"water"`; a CO₂
  target of 0 is "CO₂ target: The CO₂ target must be a number above 0 g/L.", 8 g/L a warning at the field; an
  amount of 0 is "Yeast: The yeast's amount must be a number above 0 g.", whose entry opens the Fermentation tab;
  clearing all three removes `fermentation`.
- `ACC-096` (EDT-067, EDT-068, QE-58, QE-60) The Water tab's fields have a column Typical and no separate guide box:
  mash water "2.5–5 L/kg of malt", sparge water "–", top-up water "usually 0 L"; the mash water's ⓘ lists Pils, Helles
  4–5 L/kg; Weizen, Pale Ale, IPA 3.5–4 L/kg; Märzen, Dunkel, Amber 3–3.5 L/kg; Bock, Stout, strong beers 2.5–3 L/kg,
  the sparge water's asks for the knockout volume and the malts. With 4.5 kg of malt the mash water is "11.3–22.5 L
  (2.5–5 L/kg)" and the ⓘ adds 18–22.5, 15.8–18, 13.5–15.8, 11.3–13.5 L; with 24 L knockout volume the sparge
  water's ⓘ shows "… ≈ 24 L + 2.4 L (60 min assumed, ~10 %/h) + 4.5 L (~1 L/kg) + 1 L = 31.9 L"; with 18 L mash and
  3 L top-up water the sparge water is "≈ 10.9 L" and the Total water figure "(estimate ≈ 31.9 L)"; 18 L for 4.5 kg
  (4 L/kg) is no warning; with hop additions of 90 and 10 min and 20 L: "20 L + 3 L (90 min, ~10 %/h) + 4.5 L
  (~1 L/kg) + 1 L = 28.5 L". The hop table's heads read "α %" over "2–20" and "Additions (cooking time · amount)"
  over "cooking time up to 90 min".
- `ACC-097` (EDT-069, QE-61..QE-64, QE-69, FMT-006) With Pilsner malt 4600 g 7 EBC, 18 L mash water and 24 L knockout
  volume, the Water tab's Water treatment is a table like the Rests table with the heads Step, Value, Typical and
  Effect (and, for screen readers, Used and About) and the result in its foot; it has Residual alkalinity (tap water)
  and the steps Boil the mash water, Brewing gypsum, Acid malt and Lactic acid 80 %, each with a
  checkbox and, unticked, no field and the effect "–". The result is "–", with 10.3 °dH "10.3 °dH" (also the first
  effect), the target "at most 2 °dH (9 EBC, like Pils)" and its warning. Ticked, a step's field is empty: boiling's
  effect is "–" and its carbonate hardness an error ("⊘ Boiling the mash water needs the tap water's carbonate
  hardness.", `QE-69`), its ⓘ explains boiling, with 14 °dH "−7.9 °dH"; gypsum is
  "⊘ The brewing gypsum needs an amount." until 1 g/10 L gives "−0.9 °dH" (its ⓘ: "Its calcium lowers the residual
  alkalinity: …"); 1 % acid malt "−2.4 °dH", 0.5 ml/10 L lactic acid "−1.5 °dH"; the result "−2.4 °dH" without a
  warning, its ⓘ shows the target table; the file has `"water": { "mash": 18, "treatment": { "alkalinity": 10.3,
  "carbonate_hardness": 14, "boil": true, "gypsum": 1, "acid_malt": 1, "lactic_acid": 0.5 } }`; clearing the lactic
  acid keeps it ticked ("The lactic acid needs an amount."); 4 g/10 L gypsum warns; unticking all leaves
  `"treatment": { "alkalinity": 10.3 }`, and clearing that the treatment.
- `ACC-098` (EDT-069, QE-65) For 4.6 kg of malt, 18 L mash water, tap water 10.3 °dH and 14 °dH carbonate hardness,
  boiling, 1 g/10 L gypsum, 1 % acid malt and 0.5 ml/10 L lactic acid, the rows' ⓘ show their formulas and "starting
  value 10.3 °dH", "ΔRA = −(14 − 3) × 0.714 = −7.9 °dH", "ΔRA = −1 × 0.93 = −0.9 °dH", "ΔRA = −9.34 × 4.65 × 1 ÷ 18 =
  −2.4 °dH" (4.65 kg of total malt with the acid malt), "ΔRA = −0.5 × 2.99 = −1.5 °dH" and "RA = 10.3 − 7.9 − 0.9 − 2.4 − 1.5 = −2.4 °dH"; boiling water of 2 °dH
  carbonate hardness gives "ΔRA = 0 °dH (…)"; without the inputs only the formulas.
- `ACC-099` (EDT-069, EDT-070, QE-66) With 4.6 kg of malt and 18 L mash water, 1 % acid malt is 46.5 g (1/99 of
  4600 g; the total malt 4646 g), 1 g/10 L gypsum 1.8 g and 0.5 ml/10 L lactic acid 0.9 ml in the Total column ("1.8 g",
  "46 g", "0.9 ml"; nothing for boiling); the units read "°dH residual alkalinity", "°dH carbonate hardness",
  "g/10 L mash water", "% of total malt", "ml/10 L mash water"; without mash water there are no totals of the doses.
- `ACC-100` (EDT-070, QE-67, QE-68) With Pilsner malt 4600 g 7 EBC and 1 % acid malt in the Water treatment, the Malt table
  shows after it a row like the others whose fields can't be changed ("Acid malt", 5 EBC with its swatch, 46 g; no
  "read-only" label, no handle, no ✕), 1 %, with "From the Water treatment (1 % of
  the total malt); change it on the Water tab."; Pilsner malt is 99 %, the Total "4646 g", the donut's legend 99 % and
  1 %; the file's malts are only the Pilsner malt; the link opens the Water tab, and unticking the acid malt there
  removes the row (Total 4600 g).

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
