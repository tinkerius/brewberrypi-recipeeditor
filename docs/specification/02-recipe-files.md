# 02 — Recipe Files

The format is the app's (app spec 07 §7.2, `data/recipe.schema.json`). The editor keeps a copy of the app's
schema and shipped recipes and records the app commit they come from; a check fails when they differ from that
commit (`NFR-030`).

## 2.1 Format and validation

- `FMT-001` The editor reads and writes the app's **latest recipe file format version** (today 3):
  `{"version": 3, "name": …, "description": …, "mashing_process": {"goals": [ … ]}, "mashing": { … }, "ingredients": { … },
  "batch": { … }, "water": { … }, "fermentation": { … }}`, one recipe per file. The goals MAY be empty (app `Q-34`); `mashing_process` is always there. `mashing`, the mashing
  plan (app `RCP-012`, `QE-32`), is there only while the brewer plans a rest (`EDT-034`); `ingredients` (app
  `RCP-013`, `QE-34`) only while there is a malt, a hop or another addition (`EDT-042`, `EDT-060`); `batch` (app `RCP-014`, `QE-35`) only while
  its volume or gravity is set (`EDT-050`); `water` (app `RCP-015`, `QE-36`) only while a water volume or a water treatment field (`EDT-069`) is set
  (`EDT-051`); `description` (app `RCP-016`, `QE-55`) only while it is not empty (`EDT-065`); `fermentation` (app
  `RCP-017`, `QE-57`) only while a yeast field or the CO₂ target is set (`EDT-066`).
- `FMT-002` The file name is the recipe id: `^[A-Za-z0-9_-]+$` (app `RCP-001`). Files carry no `id` field.
- `FMT-003` Reading a file:
  - without `version`, or in version 1 or 2 → read as the latest version, content unchanged (app migrators 1 → 2
    and 2 → 3 change nothing but the version);
  - old flat format (`goals` at the top level, before app `Q-31`) → the goals are moved into `mashing_process`
    and the editor says so (`EDT-021`);
  - a `version` that is not 1, 2 or 3 and not a whole number above 3 → written as the latest version, and the
    editor says so;
  - a hop or other addition with an amount or cooking time of its own (`grams`, `minutes`; version 3 before app
    `Q-43`, never released) → moved into its additions (`EDT-061`): its only addition while it has none, else its
    first unless an addition with the same values is there; nothing is dropped, and the editor says so ("Converted:
    hop 1 "Hallertauer": its own amount and cooking time are moved into its additions."). Drafts kept in the browser
    are converted the same way when the editor starts (`QE-53`);
  - a `version` above the latest → **refused**: the recipe cannot be opened, with the message that it was written
    for a newer BrewberryPi app. The editor MUST NOT drop what it does not know.
  - not JSON → refused with the parser's message (upload: listed as not opened; Drive: shown as a load error).
- `FMT-004` Validation MUST give the same verdict as the app's schema for every file (valid or not), and name each
  problem with where it is (file name, recipe name, goal n and its field). Problems:
  file name missing or invalid; name empty; `mashing_process` or its `goals` missing or not a list; unknown goal
  type; a parameter missing, of the wrong type or out of range (temperature 0…110 °C, minutes a whole number ≥ 0);
  a Rest with only one of name and description; a field the goal type does not take; in the mashing plan
  (app `RCP-012`): not an object, an unknown rest, a rest that is not an object, a rest without temperature or
  minutes or with any other field, the same ranges as for goals; in the ingredients (app `RCP-013`): not an object,
  a list other than `malts`, `hops` and `others`, a list that is not a list, an entry that is not an object, without a name
  (or an empty one), a malt without grams, grams that are not a whole number ≥ 1, a malt's EBC below 0, a hop's alpha
  acid outside 0–100, a hop or another addition without `additions` (a list of at least one; app `Q-43`, `QE-49`),
  an addition that is not an object, without grams, with a boil time that is not a whole number ≥ 0 or with any
  other field, alpha acid on another addition, any other field of an entry; in the batch (app
  `RCP-014`): not an object, a volume not above 0, an original or final gravity outside 0–40 °P, any other field; in the water (app `RCP-015`): not an
  object, a volume that is not a number ≥ 0, in its `treatment` (`Q-46`, `EDT-069`): not an object, a residual
  alkalinity that is not a number, a carbonate hardness, gypsum or lactic acid below 0 or not a number, acid malt
  outside 0–100 %, boiling that is not yes or no, boiling without the carbonate hardness (app `Q-47`), any other field; any other field; a `description` that is not a string; in the
  fermentation (app `RCP-017`): not an object, a yeast that is not an object, without a name (or an empty one), with
  grams not above 0 or any other field, a CO₂ target not above 0, any other field; any other key. An entry is named by its table and number ("Malt 2"), an addition by its entry and number ("Hop 2, addition 1"). A rest is named by its short name
  ("Mashing, Maltose rest"). A temperature outside a rest's typical range is not a problem (`EDT-033`).
  Messages name goal types by their display name (e.g. "A Heat Up goal needs a temperature."), never by the type
  name of the file; only a type the editor does not know is quoted as written in the file (`QE-24`).
- `FMT-005` A file with problems is still opened, keeping every field it had, so the brewer sees and fixes the
  problems (`EDT-020`). Fields a goal type does not take can be removed with one action.
- `FMT-006` Written files (download, Drive) are formatted like the app's shipped recipes: `version` first, then
  `name`, then `description` (if any) on one line, then `mashing_process` with one goal per line, then `mashing` (if any) with one rest per line in the
  order of the rest table (`EDT-031`), then `ingredients` (if any) with `malts`, `hops`, `others` in this order and one entry per
  line in the brewer's order (keys `name`, `grams`, `ebc`, `alpha`, `additions`; a hop's or another addition's
  `additions` inline, each `minutes` before `grams`), then `batch` (if any) on one line, `liters`, `plato`, `final_plato`, then `water` (if any) on one line, `mash`,
  `sparge`, `top_up`, `treatment` inline (`alkalinity`, `carbonate_hardness`, `boil`, `gypsum`, `acid_malt`,
  `lactic_acid`), then `fermentation` (if any) on one line, `yeast` (`name`, `grams`), `co2`; no `$schema`. Reading a written file gives the same recipe.
- `FMT-007` The samples are exactly the app's shipped recipes (app `RCP-002`; today `BENIWEISS` and `WaterBoil`);
  `EDT-016` uses `BENIWEISS`.
  The editor MUST NOT contain other recipes, not even in tests (app `Q-32`).
- `FMT-008` Recipe texts are data: names and descriptions, including legacy spellings, are kept as they are
  (app `Q-07`).
- `FMT-009` When the app raises the format version (app `RCP-011`), the editor follows in the same release: it
  writes the new version and reads older ones like the app's migrators do.

## 2.2 Saving and downloading

- `FMT-010` A recipe with problems (`FMT-004`) MUST NOT be downloaded or saved to Drive. A complete recipe without
  goals MAY be (app `Q-34`); the editor notes that the app lists it but cannot brew it (`GUI-041`).
