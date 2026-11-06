# 02 — Recipe Files

The format is the app's (app spec 07 §7.2, `data/recipe.schema.json`). The editor keeps a copy of the app's
schema and shipped recipes and records the app commit they come from; a check fails when they differ from that
commit (`NFR-030`).

## 2.1 Format and validation

- `FMT-001` The editor reads and writes the app's **latest recipe file format version** (today 2):
  `{"version": 2, "name": …, "mashing_process": {"goals": [ … ]}}`, one recipe per file. The goals MAY be empty
  (app `Q-34`); `mashing_process` is always there.
- `FMT-002` The file name is the recipe id: `^[A-Za-z0-9_-]+$` (app `RCP-001`). Files carry no `id` field.
- `FMT-003` Reading a file:
  - without `version`, or in version 1 → read as the latest version, content unchanged (app migrator 1 → 2
    changes nothing but the version);
  - old flat format (`goals` at the top level, before app `Q-31`) → the goals are moved into `mashing_process`
    and the editor says so (`EDT-021`);
  - a `version` that is not 1 or 2 and not a whole number above 2 → written as the latest version, and the editor
    says so;
  - a `version` above the latest → **refused**: the recipe cannot be opened, with the message that it was written
    for a newer BrewberryPi app. The editor MUST NOT drop what it does not know.
  - not JSON → refused with the parser's message (upload: listed as not opened; Drive: shown as a load error).
- `FMT-004` Validation MUST give the same verdict as the app's schema for every file (valid or not), and name each
  problem with where it is (file name, recipe name, goal n and its field). Problems:
  file name missing or invalid; name empty; `mashing_process` or its `goals` missing or not a list; unknown goal
  type; a parameter missing, of the wrong type or out of range (temperature 0…110 °C, minutes a whole number ≥ 0);
  a Rest with only one of name and description; a field the goal type does not take; any other key.
- `FMT-005` A file with problems is still opened, keeping every field it had, so the brewer sees and fixes the
  problems (`EDT-020`). Fields a goal type does not take can be removed with one action.
- `FMT-006` Written files (download, Drive) are formatted like the app's shipped recipes: `version` first, then
  `name`, then `mashing_process` with one goal per line; no `$schema`. Reading a written file gives the same recipe.
- `FMT-007` The samples are exactly the app's shipped recipes (app `RCP-002`; today `BENIWEISS` and `WaterBoil`).
  The editor MUST NOT contain other recipes, not even in tests (app `Q-32`).
- `FMT-008` Recipe texts are data: names and descriptions, including legacy spellings, are kept as they are
  (app `Q-07`).
- `FMT-009` When the app raises the format version (app `RCP-011`), the editor follows in the same release: it
  writes the new version and reads older ones like the app's migrators do.

## 2.2 Saving and downloading

- `FMT-010` A recipe with problems (`FMT-004`) MUST NOT be downloaded or saved to Drive. A complete recipe without
  goals MAY be (app `Q-34`); the editor notes that the app lists it but cannot brew it (`GUI-041`).
