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
- `EDT-012` **+ Add goal** asks for the type first (`EDT-017`) and adds a goal of that type at the end. Goals can be
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

