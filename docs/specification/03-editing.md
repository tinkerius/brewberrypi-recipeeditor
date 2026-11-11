# 03 — Editing

Applies signed out (drafts, §4) and signed in (Drive recipes, §5) alike, unless a requirement says otherwise.

## 3.1 Creating and opening

- `EDT-001` **New recipe** asks for the file name (`EDT-003`) and then opens an **empty** recipe: no name, no goals
  (`FMT-001`). It is incomplete until it has a name (`FMT-004`).
- `EDT-002` *(removed 2026-11-06, `QE-17`: there is no "New from a sample recipe"; a new workspace gets a sample
  instead, `EDT-016`.)*
- `EDT-003` The file name is asked **only** when a recipe is created (new, duplicate) and when it is
  renamed (`EDT-006`), in a dialog. The dialog refuses a name that is invalid (`FMT-002`) or already used by
  another recipe in the list, and says why; Enter confirms, Escape cancels. There is no file name field in the
  editor itself (`GUI-030`).
- `EDT-004` A suggested file name is the source's id if it is free, else `<id>-2`, `<id>-3`, … (the first free one).
- `EDT-005` **Upload recipe** (one or several files, or files dropped onto the page) opens each file as a new recipe named
  after the file (`<id>.json` → `<id>`). A name already in the list gets the next free one (`EDT-004`) and a
  notice. Files that cannot be opened (not JSON, larger than 1 MB, unreadable, newer format, `FMT-003`) are
  listed in one notice; the others are opened.
- `EDT-016` A **new workspace gets the sample `BENIWEISS`** (`FMT-007`) once, so a new user sees an example
  (`QE-17`):
  - signed in: at the first sign-in with a Google account, when the editor creates the Drive folder
    (`DRV-003`), the file `BENIWEISS.json` is saved there;
  - signed out: on the first visit in a browser, when the browser storage is created, as a draft (`BRW-001`); without
    browser storage (`BRW-002`) every visit counts as the first.

  It is not added again later, also not when the user deleted it or the list is empty.

## 3.2 Recipe actions (menu)

- `EDT-006` **Rename…** asks for the new file name (`EDT-003`).
  - Draft: the recipe gets the new name; it counts as not downloaded again (`BRW-004`).
  - Drive recipe: the file is renamed in Drive at once, its content unchanged; unsaved changes stay unsaved. If the
    file was changed elsewhere meanwhile, the next save still detects it (`DRV-007`).
  - A Drive recipe not saved yet just gets the new name.
- `EDT-007` **Duplicate…** asks for the file name, suggesting the next free one (`EDT-004`), and opens a copy as a
  new recipe (a draft, or a Drive recipe not saved yet).
- `EDT-008` **Delete…** asks first. A draft is deleted from the browser for good; a Drive recipe is moved to the
  Drive trash (restorable there for 30 days); a recipe not saved yet is just removed.
- `EDT-009` **Download** saves `<id>.json` (`FMT-006`) to the user's computer, if the recipe is complete
  (`FMT-010`); otherwise it selects the recipe and says to fix it first.

## 3.3 Editing a recipe

- `EDT-010` The recipe name is edited **in the title** (`QE-21`): clicking the name, or the pencil next to it, turns it
  into a text field; Enter or leaving the field keeps the change, Escape restores the name it had before. A recipe
  without a name (a new one) starts with the field open. There is no separate name field.
- `EDT-011` Goals are listed in brewing order, **one line each** (`QE-26`): the goal's type by its display name
  only (all goal types of app spec 04; the type names of the file, e.g. `HeatUp`, are not shown, `QE-24`) and its
  values as a short sentence, e.g. "Heat Up to 62 °C", "Rest at 65 °C for 30 min — Maltoserast" (the name of a Rest
  or Cook after a dash). A missing value reads "?"; a goal with a problem (`EDT-020`) is marked in its line.
  Clicking the line opens the goal below it, one goal at a time (opening another closes it; clicking the line again
  closes it): the one-line explanation of its type, the pencil to change the type (`EDT-014`), and the fields its
  type takes (app `RCP` §7.3 table): temperature, minutes, and for Rest optionally both name and description (one
  switch adds or removes both); CookWater always has name and description. A goal added with **+ Add goal** opens.
- `EDT-012` **+ Add goal**, the last row of the goal list (an add row: the full width, in the brand colour, below a
  dashed line; `QE-34`), asks for the type first (`EDT-017`) and adds a goal of that type at the end. Goals can be
  removed, and reordered by **drag and drop**
  (`QE-20`): each goal has a drag handle; dragging it with the mouse or a finger moves the goal, a line shows where it
  will be dropped, and releasing puts it there. With the keyboard, the arrow keys on the focused handle move the goal
  one place up or down, and the handle keeps the focus. There are no move-up/move-down buttons.
- `EDT-013` A new goal starts valid where possible: HeatUp 62 °C; Rest and IodineTest 62 °C, 10 min; CookWater
  60 min with empty name and description (to be filled in).
- `EDT-014` The pencil of an open goal (`EDT-011`) asks for the new type (`EDT-017`, the current one marked). Changing it
  keeps the values the new type also takes and drops the others. A goal of an unknown type (`FMT-004`) shows
  "Unknown: <type>" with the same pencil.
- `EDT-017` The goal type is chosen in a dialog that lists every goal type with its display name and its
  one-line explanation (`EDT-011`); choosing one confirms, Escape or Cancel changes nothing. There is no type
  dropdown in the goal list (`QE-23`).
- `EDT-015` Number fields keep what is typed even while it is not a number yet (e.g. `62.`); a value that is not a
  number is reported as a problem (`FMT-004`), not silently dropped. A comma is accepted as decimal separator.

## 3.4 Problems and notices

- `EDT-020` Problems (`FMT-004`) are listed below the goals, each with where it is; fields with a problem are
  marked. A goal's problem names the goal ("Goal 2"); clicking that opens the goal (`EDT-011`). For an invalid file name the message says to rename it from the recipe's menu.
- `EDT-021` When the editor changed a file while reading it (`FMT-003`), it says what it changed until the recipe
  is downloaded or saved.

## 3.5 Mashing plan (`QE-32`)

- `EDT-030` The tab **Mashing** (`GUI-032`) is the brewer's mashing plan (app `RCP-012`): which rests the mash
  gets, each with its temperature and duration. It is design information for the brewer; it does not change the
  goals (**Mash Process**), and the app does not use it. (Goals made from the plan may follow later.)
- `EDT-031` Below the heading **Rests**, the tab has a **table** with one row per rest of the table below, each once, in this order. Its columns:
  a check box, the rest's name, the planned **°C**, its **Typical** range, the planned **min**, its **Typical**
  duration, and an **ⓘ** button. The planned values are fields
  in their own columns, so the plan reads at a glance; a ticked row is highlighted, an unticked one has no fields.
  The typical values are in their own columns, so they line up whether a rest is ticked or not: after °C the
  "warning outside" range as "<from>–<to> °C" (e.g. "60–65 °C"), after min the typical duration. On a phone the
  Rest column shows the rest's short name ("Maltose rest"), so all columns fit. The ⓘ
  button ("About this rest") expands what the rest does (enzymes, effect, when useful) below its row, one rest at
  a time; pressing it again collapses it. The texts are the product owner's (2026-11-10), verbatim.

| Rest id | Name | Temperature range | Typ. duration | Warning outside | Preset |
|---|---|---|---|---|---|
| `PreMash` | Pre-mash / Dough-in rest (soaking) | Room temp. to 40 °C, typ. ~25 °C | 15–30 min (cold: up to several hours) | 15–40 °C | 25 °C, 20 min |
| `AcidRest` | Acid rest / Phytase rest | 30–35 °C (up to 52 °C), typ. ~35 °C | 30–120 min | 30–52 °C | 35 °C, 30 min |
| `BetaGlucanRest` | Beta-glucan rest (gum rest) | 35–45 °C, typ. ~40 °C | 15–20 min | 35–45 °C | 40 °C, 15 min |
| `FerulicAcidRest` | Ferulic acid rest | 43–45 °C, typ. ~45 °C | 15–20 min | 43–45 °C | 45 °C, 15 min |
| `ProteinRest` | Protein rest (protease rest) | 45–55 °C, typ. ~52 °C | 10–20 min | 45–55 °C | 52 °C, 10 min |
| `MaltoseRest` | Maltose rest (beta-amylase rest) | 60–65 °C, typ. ~63 °C | 30–60 min | 60–65 °C | 63 °C, 45 min |
| `CombinedRest` | Combined rest (single infusion) | 65–68 °C, typ. ~67 °C | 60 min | 65–68 °C | 67 °C, 60 min |
| `SaccharificationRest` | Saccharification rest (dextrinization / alpha-amylase rest) | 70–75 °C, typ. ~72 °C | 20–40 min, until iodine-negative | 70–75 °C | 72 °C, 30 min |
| `MashOut` | Mash-out | 76–78 °C, typ. ~78 °C | Heat up + 5–10 min | 76–78 °C | 78 °C, 10 min |

  What each rest does (**About this rest**):
  - Pre-mash / Dough-in rest: **Enzymes:** no targeted enzyme activity; amylases and proteases dissolve from the
    malt into the mash. Phytase and β-glucanase are slightly active at ~35–40 °C. **Effect:** hydrates the grist,
    softens the endosperm, prevents dough balls; enzymes are already in solution when the actual rests begin.
    **When useful:** coarse crush (e.g. lauter tun systems), poorly modified malts, before decoction, or to slightly
    increase efficiency. Cold pre-mashing also extracts fewer tannins and husk flavors.
  - Acid rest / Phytase rest: **Enzyme:** phytase. **Effect:** releases phosphates and lowers mash pH. **When
    useful:** practically never today (historically for low-acid malt); pH adjustment is easier with lactic acid or
    acidulated malt.
  - Beta-glucan rest: **Enzyme:** β-glucanase. **Effect:** breaks down beta-glucans (gums), lowers viscosity,
    improves lautering and filterability. **When useful:** high share of rye, oats, unmalted adjuncts, or poorly
    modified malts. Rapidly denatured above ~50 °C.
  - Ferulic acid rest: **Enzyme:** feruloyl esterase. **Effect:** releases ferulic acid, which phenolic (POF+)
    yeast converts to 4-vinyl guaiacol (clove aroma). **When useful:** wheat beer and other styles with POF+ yeast
    when more clove character is desired.
  - Protein rest: **Enzymes:** peptidases (~45–50 °C), proteinases (~50–55 °C). **Effect:** lower range produces
    free amino nitrogen (FAN) as yeast nutrient; upper range breaks down large proteins, reducing haze. **When
    useful:** wheat, unmalted adjuncts, poorly modified malts. With modern well-modified malts keep it short or skip
    it, otherwise foam and body suffer.
  - Maltose rest: **Enzyme:** β-amylase. **Effect:** cleaves maltose from starch chains, producing highly
    fermentable wort, high attenuation, lean and dry beer. **When useful:** almost always; extend for dry beers
    (Pils, Saison, Tripel). Heat-sensitive; prefers pH ~5.4 and a thick mash.
  - Combined rest: **Enzymes:** β- and α-amylase simultaneously. **Effect:** compromise between attenuation and
    body; lower temperature gives a drier beer, higher a fuller one. **When useful:** simple brewing (infusion,
    BIAB) with well-modified malts.
  - Saccharification rest: **Enzyme:** α-amylase. **Effect:** breaks down starch into (unfermentable) dextrins,
    giving body, mouthfeel, and foam stability. **When useful:** almost always; extend for full-bodied beers (Bock,
    Märzen, Stout). Check for complete starch conversion with an iodine test before mash-out.
  - Mash-out: **Enzymes:** none (inactivation). **Effect:** fixes the sugar profile, lowers viscosity for better
    lautering. **When useful:** always. Do not exceed 78 °C, otherwise α-amylase is also destroyed and starch
    dissolved during lautering stays unconverted (starch haze).
- `EDT-032` Ticking a rest plans it with its preset temperature and duration (table above); its **Temperature**
  (°C) and **Duration** (min, a whole number) fields appear and can be changed (`EDT-015`). Unticking it removes the
  rest from the plan, with its values.
- `EDT-033` A planned rest whose temperature is outside its "warning outside" range (inclusive) shows a warning:
  its temperature field and its typical range are marked amber, and "⚠ Outside the typical range" follows that
  range. It is only a warning: the recipe stays complete and can be saved and
  downloaded (`FMT-010`).
- `EDT-034` The plan holds only ticked rests. When no rest is ticked, the recipe file has no `mashing`; a file read
  with an empty `mashing` (`{}`) keeps it until a rest is ticked and unticked.
- `EDT-035` Problems of the plan (`FMT-004`) are listed with the others (`EDT-020`) as "Mashing, <rest>"; clicking
  that opens the Mashing tab, and the field with the problem is marked. Clicking a goal's "Goal n" opens the Mash
  Process tab with that goal open.

## 3.6 Mash temperature ladder (`QE-33`)

- `EDT-036` Above the table of the Mashing tab, below the heading **Temperature Ladder**, is the **temperature
  ladder**, a chart whose y-axis is the mash
  temperature (°C):
  - every rest of `EDT-031` is a **band** over its typical temperature range, in its own lane wherever ranges
    overlap or touch, so no two bands cover each other; its temperature is ticked on the band: the planned
    temperature when the rest is planned (with a valid number), else the typical one;
  - beside the bands, a **label** per rest, sorted by typical temperature: its short name and the same temperature as its tick
    (one line; what the rest does is in its tooltip, `EDT-037`); labels are moved apart where they would collide,
    with a line to their band; an obsolete rest (the acid rest) is greyed and says "(obsolete)"; planned rests are in the
    brand colour;
  - the **limit of 78 °C** is a red dashed line with "max 78 °C" (above it α-amylase is destroyed, `EDT-031`
    Mash-out);
  - the scale spans every band, the limit and every planned temperature.
  On narrow screens the schedule (`EDT-039`) is drawn below the ladder, on the same temperature scale, instead of
  beside it.
- `EDT-037` A rest's band and label show its name, range, enzymes, effect and when it is useful as a tooltip;
  clicking one (or Enter on it) opens that rest's texts in the table (`EDT-031`).
- `EDT-038` The schedule's **warnings** are listed below the ladder; they are warnings, not problems: the recipe
  stays complete (`FMT-010`). A warning is given for:
  - a step whose temperature is lower than the step before it (the steps should rise);
  - a step above 78 °C;
  - a plan with steps but none that converts the starch (Combined rest or Saccharification rest; flag
    `conversion`), as the starch may not be converted completely;
  - a hold outside the rest's typical duration (`durationMin`..`durationMax`; table below).
- `EDT-039` The **schedule** is the planned rests in the table's order (a rest whose temperature or duration is not a
  valid number yet is left out until it is), drawn as the temperature profile over time over the bands of the
  planned rests: it starts at the first step's temperature and heats to each step's temperature at the heating
  rate, then holds it for the step's minutes. A step lower than the one before is reached at the same rate. The
  time axis is in minutes. Above the chart: "Total mash time <total>: <holds> of rests, <ramps> heating at <rate>
  °C/min." (times as "45 min" or "2 h 18 min"); "No rests planned yet." and, in the chart, "Tick rests below to
  draw the schedule." while there are no steps.
- `EDT-040` The **heating rate** (°C/min, default 1) is a field next to the total. It is not stored: the recipe
  file has no place for it, and the editor keeps nothing else in the browser (`NFR-002`); a value that is not a
  number above 0 counts as 1.

All rest values live in one file, the rest data (`src/mashRests.ts`): names, typical temperature range and
temperature, typical duration (text and `durationMin`/`durationMax`), presets, enzymes, effect, when useful and the
flags `obsolete`, `optional`, `always` and `conversion`; neither the table, the ladder nor the warnings write a
temperature of their own. The typical durations of `EDT-038` and the flags:

| Rest | Typical duration (min) | Flags |
|---|---|---|
| Pre-mash | 15– (no upper limit: cold, up to several hours) | optional |
| Acid rest | 30–120 | obsolete |
| Beta-glucan rest | 15–20 | optional |
| Ferulic acid rest | 15–20 | optional |
| Protein rest | 10–20 | optional |
| Maltose rest | 30–60 | optional |
| Combined rest | 60 | optional, conversion |
| Saccharification rest | 20–40 | optional, conversion |
| Mash-out | 5–10 | always |

## 3.7 Malt and hops (`QE-34`, `QE-35`)

- `EDT-041` The tabs **Malt** and **Hops** (`GUI-032`) hold the brew's ingredients (app `RCP-013`), each tab one
  table, with the donut of the shares at the left and the figure computed from the table at the right above it
  (stacked on a phone; `QE-37`). The table has the heading **Malt** or **Hops** (`QE-36`); on the Hops tab the **Hop Schedule** (`EDT-054`)
  follows it under its own heading. Like the mashing plan, they are design information for the brewer; they do not change the goals, and the
  app does not use them.
- `EDT-042` A table has a drag handle, then the columns (`QE-40`) — Malt: **Name**, **EBC** (its colour), **Absolute
  amount (g)** (a whole number), **Relative amount (%)**; Hops: **Name**, **α %** (its alpha acid), **Cooking time
  (min)** (its boil time, a whole number), **Absolute amount (g)**, **Relative amount (%)** — and a button ✕ ("Remove
  malt" / "Remove hop") per row; EBC, α % and min may stay empty (an empty one is left out
  of the file). After the last row and before the Total line, an add row like the goal list's (`EDT-012`),
  **+ Add malt** (or **+ Add hop**), adds an empty row at the end, whose name field gets the focus. The rows keep
  the brewer's order. ✕ removes the row. An empty table says "No malt yet." / "No hop yet."; a table without rows
  is left out of the file, and `ingredients` too when both are empty.
- `EDT-043` The **Relative amount (%)** column is a row's share of its table's total weight (a hop's of all hops), rounded to one
  decimal ("90 %", "33.3 %"), with a swatch in its colour of the donut (`EDT-047`); it is computed, never stored. A
  row whose amount is not a whole number ≥ 1 yet shows "–" and does not count. The last line, **Total**, sums the
  table's amounts ("5000 g", under Absolute amount) and shows "100 %" while the total is above 0.
- `EDT-044` A row needs a name and an amount: until it has both, it is a problem (`FMT-004`) and the recipe cannot
  be saved or downloaded; the field with the problem is marked. The same name may appear twice. An EBC below 0, an
  alpha acid outside 0–100 % or a boil time that is not a whole number ≥ 0 is a problem too.
- `EDT-045` Problems of the ingredients and the batch are listed with the others (`EDT-020`) as "Malt n", "Hop n",
  "Knockout volume" or "Original gravity"; clicking that opens its tab (the knockout volume: Water; the gravity:
  Hops).
- `EDT-046` The rows of each table are reordered like the goals (`EDT-012`): by dragging the handle, with a line
  where the row will be dropped, or with the arrow keys on the focused handle (the handle keeps the focus). The
  shares move with their rows; the file keeps the new order.
- `EDT-047` Above the table, at the left of the figure, a **donut** shows the shares of the rows with an amount, one slice per row in table
  order, with the total weight in its middle, a tooltip per slice ("Pilsner malt: 4500 g, 90 %") and a legend
  (swatch, name, share). The slices take the categorical chart colours in a fixed order by row (validated for
  colour-vision deficiency in light and dark mode); from the 9th row on they share one "other" grey. No donut
  while no row has an amount.
- `EDT-048` The Malt tab shows the **beer colour** in EBC by Morey's formula (MCU = Σ lb · °L / gal, SRM = 1.4922 ·
  MCU^0.6859, EBC = SRM · 1.97, each malt's EBC as °L = (EBC · 0.508 + 0.76) / 1.3546), rounded to a whole number
  ("9 EBC"), with a swatch of that colour (the SRM colour chart). It needs the EBC of every malt with an amount and
  the knockout volume (from the Water tab); until then it shows "–" and says what to enter ("Enter the EBC of malt 2
  and the knockout volume on the Water tab.", "Water tab" a link that opens it). With a colour, the hint names the
  volume used: "Morey's formula, from each malt's EBC and the knockout volume (20 L, Water tab)."; below the figure
  the colour scale (`EDT-055`).
- `EDT-049` The Hops tab shows the **bitterness** in IBU by Tinseth's formula (per hop, 1.65 · 0.000125^(SG − 1) ·
  (1 − e^(−0.04 · min)) / 4.15 · alpha/100 · g · 1000 / l, SG from the original gravity in °P), rounded to a whole
  number ("19 IBU"). It needs the alpha acid and boil time of every hop with an amount, the knockout volume and
  the original gravity (both from the Water tab); until then it shows "–" and says what to enter ("… and the
  knockout volume and the original gravity on the Water tab."). With a bitterness, the hint names both values used
  ("the original gravity (12.6 °P, Water tab)"); below the figure the bitterness scale and BU:GU (`EDT-056`).
- `EDT-050` The **batch** fields (app `RCP-014`) are entered on the Water tab only (`EDT-051`, `EDT-057`; `QE-37`,
  `QE-38`): the **Knockout volume** (L, the wort at the end of the boil, the target for the fermenter; `QE-36`), the
  target **Original gravity** and the **Final gravity** (°P). The Malt and Hops tabs use them and name them in their
  hints (`EDT-048`, `EDT-049`); they have no batch fields. A field left empty is left out of the
  file, and `batch` too when both are.
- `EDT-054` The **Hop Schedule** lists the hops with an amount and a boil time by when they go into the boil,
  longest boil first (ties in table order): a timeline over the boil, from its start (the longest boil time) at the
  left to its end at the right, one row and dot per hop in its donut colour (`EDT-047`) with the time at the left
  ("60 min", 0 min as "flame-out") and a tooltip ("Hallertauer Tradition: 30 g, 60 min before the end of the boil");
  below it a table with the headers **Cooking time**, **Hops** and **Amount** (time with the hop's colour, name,
  grams; `QE-40`). Hops with an amount but no boil time are named in a hint ("No boil time
  yet: hop 4."); without any boil time it says "Enter the hops' amounts and boil times to see when each goes into
  the boil."

- `EDT-055` Below the beer colour, a **colour scale** shows where it lies among common beers: the SRM colour chart
  as a bar from 0 to 80 EBC (numbers 0, 20, 40, 60, "80+"), a marker at the beer's colour (a darker beer at the end),
  and the styles Pils, Pale Ale, Märzen, Dunkel and Stout at their typical colours. Below it: "In the range of:
  Helles, Weissbier." for the styles whose range holds the rounded colour, "Darker than a typical stout." above
  80 EBC, else "Between the common styles.". The styles' ranges (EBC, from the BJCP 2021 guidelines' SRM × 1.97):

| Style | EBC | On the scale |
|---|---|---|
| Pils | 4–8 | yes |
| Helles | 6–10 | |
| Weissbier | 4–12 | |
| Pale Ale | 10–20 | yes |
| Märzen | 16–33 | yes |
| Dunkel | 33–55 | yes |
| Stout | 49–79 | yes |

- `EDT-056` Below the bitterness, a **bitterness scale** like the colour scale (`EDT-055`): a bar from 0 to 100 IBU
  ("100+") in hop greens, light to dark, a marker at the bitterness, the styles Weissbier, Helles, Pils, Pale Ale and
  IPA at their typical bitterness, and "In the range of: …" (the styles whose range holds the rounded IBU), "More
  bitter than a typical IPA." above 100 IBU, else "Between the common styles.". Below it **BU:GU**, the bitterness
  against the original gravity (IBU / ((SG − 1) · 1000)), with two decimals and how it reads: below 0.35 "malty",
  up to 0.55 "balanced", up to 0.8 "bitter", above "very bitter" ("BU:GU 0.37: balanced (bitterness against the
  original gravity)."). The styles' bitterness (IBU, BJCP 2021):

| Style | IBU | On the scale |
|---|---|---|
| Weissbier | 8–15 | yes |
| Helles | 16–22 | yes |
| Märzen | 18–24 | |
| Dunkel | 18–28 | |
| Pils | 22–40 | yes |
| Stout | 25–45 | |
| Pale Ale | 30–50 | yes |
| IPA | 40–70 | yes |

- `EDT-058` Next to each malt's EBC field, a swatch shows the malt's colour (the SRM chart colour of its EBC, as for
  the beer, `EDT-048`), with the tooltip "About the colour of 200 EBC"; none while the EBC is empty or invalid.

- `EDT-059` Below the BU:GU line, a slim **balance bar** of its bands (`EDT-056`): malty 0–0.35, balanced
  0.35–0.55, bitter 0.55–0.8 and very bitter from 0.8 (drawn to 1.0, "1.0+"), coloured from malt amber through a
  neutral grey (balanced) to light and dark hop green, with 2 px gaps; the band names above (the beer's band in bold),
  the limits below, and a marker at the beer's BU:GU (above 1.0 at the end). No style names: BU:GU ranges of styles
  overlap too much to help.

## 3.8 Water (`QE-36`)

- `EDT-051` The tab **Water** (`GUI-032`) holds the brewing-day water (app `RCP-015`) under the heading **Water**,
  and the gravity under the heading **Gravity** (`EDT-057`). Under Water:
  **Mash water** (strike water, mashed in with the malt), **Sparge water** (rinses the sugar out of the grain while
  lautering) and **Top-up water** (added after lautering to reach the original gravity), in litres, each a number
  ≥ 0 with a one-line hint, and the **Knockout volume** (`EDT-050`, entered only here; the Malt and Hops tabs use it). A
  field left empty is left out of the file, and `water` too when all three are. A volume below 0 is a problem
  ("Mash water: The mash water must be a number of at least 0 litres."); clicking it opens the Water tab.
- `EDT-052` Below the fields, computed and never stored: **Total water**, the sum of the volumes entered ("32.5 L",
  "–" while none is), and the **Mash thickness**, the mash water per kg of malt (the Malt tab's total weight), with
  one decimal ("3.2 L/kg") and the hint "(mash water per kg of malt; typical 2.5–4 L/kg)"; without the mash water or
  malts it shows "–" and what to enter ("Enter the mash water.", "Enter the malts on the Malt tab.").
- `EDT-053` The names are the English brewing terms: mash water (German Hauptguss), sparge water (Nachguss), top-up
  water (Verdünnungswasser), knockout volume (Ausschlagwürze).
- `EDT-057` Under **Gravity**: the **Original gravity (target)** and the **Final gravity** (°P, each 0–40, app
  `RCP-014` `plato` and `final_plato`) with one-line hints, and computed, never stored: the **Alcohol** in % vol by
  Balling's formula (real extract RE = 0.1808 · OE + 0.8192 · AE, ABW = (OE − RE) / (2.0665 − 0.010665 · OE), ABV
  = ABW · SG(AE) / 0.7907), one decimal ("5.1 % vol"), and the **Apparent attenuation** ((OE − AE) / OE, "79 %").
  Without both gravities they show "–" and say what to enter; a final gravity not below the original gravity says
  "The final gravity must be below the original gravity.".
