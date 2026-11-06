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

- `EDT-010` The recipe name is edited in a text field.
- `EDT-011` Goals are listed in brewing order. Each goal has its type (all goal types of app spec 04, with their
  display name), a one-line explanation, and the fields its type takes (app `RCP` §7.3 table): temperature,
  minutes, and for Rest optionally both name and description (one switch adds or removes both); CookWater always
  has name and description.
- `EDT-012` Goals can be added (of a chosen type, at the end), removed, and moved up and down.
- `EDT-013` A new goal starts valid where possible: HeatUp 62 °C; Rest and IodineTest 62 °C, 10 min; CookWater
  60 min with empty name and description (to be filled in).
- `EDT-014` Changing a goal's type keeps the values the new type also takes and drops the others.
- `EDT-015` Number fields keep what is typed even while it is not a number yet (e.g. `62.`); a value that is not a
  number is reported as a problem (`FMT-004`), not silently dropped. A comma is accepted as decimal separator.

## 3.4 Problems and notices

- `EDT-020` Problems (`FMT-004`) are listed below the goals, each with where it is; fields with a problem are
  marked. For an invalid file name the message says to rename it from the recipe's menu.
- `EDT-021` When the editor changed a file while reading it (`FMT-003`), it says what it changed until the recipe
  is downloaded or saved.
