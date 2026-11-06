# 09 — Acceptance Criteria

Automated criteria run with a fake browser storage, a fake Google Drive and no network. Each has a test whose name
starts with its ID (`NFR-031`). Criteria marked *manual* need a real Google account and are checked by hand before
a release that changes sign-in or Drive behaviour.

## 9.1 Recipe files

- `ACC-001` (FMT-004) For each case of a list of valid and invalid recipes (every goal type, missing and wrong
  fields, out-of-range values, Rest with only a name, unknown keys, old format, versions 0, 1, 2, 3, `"1"`), the
  editor's validation and the app's schema agree on valid / not valid; the editor names the goal and field.
- `ACC-002` (FMT-002) File names `BENIWEISS`, `WaterBoil`, `my-recipe_2` are accepted; ``, `with space`, `umlaut-ä`,
  `dot.json`, `../x` are refused.
- `ACC-003` (FMT-006) Each shipped recipe written by the editor equals its file without the `$schema` line; any
  recipe written and read again is the same; an empty recipe is written as `version`, `name`, `mashing_process`.
- `ACC-004` (FMT-003) A file without `version` or with `"version": 1` is read as version 2 with the same content,
  without a notice.
- `ACC-005` (FMT-003) A file with `goals` at the top level is read with the goals in `mashing_process`, with a notice
  saying so, and is valid.
- `ACC-006` (FMT-003) A file with `"version": 3` cannot be opened; the message names format version 3.
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
  end; Cancel adds nothing. The pencil of a HeatUp 40 °C goal opens the dialog with HeatUp marked; choosing Rest makes
  it a Rest of 40 °C. There is no type dropdown in the goal list.
- `ACC-044` (QE-24, EDT-011, EDT-017, FMT-004) No goal's type name of the file (`PourInBrewingWater`, `HeatUp`, …) is
  shown: not in the goal list, not in the type dialog, not in the problems ("A Heat Up goal needs a temperature.").
- `ACC-045` (DRV-006, GUI-031, QE-25) A Drive recipe without changes: Discard changes is disabled. After changing
  its name it is enabled; Discard changes and Cancel keep the change; Discard changes and confirming show the name
  saved in Drive again and "Saved in Google Drive", and the file in Drive is unchanged. A recipe not saved yet:
  disabled.
- `ACC-017` (BRW-004, DRV-010) A recipe has pending changes until it is downloaded (draft) or saved (Drive), and again
  after a change.
- `ACC-018` (EDT-016) On the first visit (new browser storage) the list holds the draft `BENIWEISS`; on a later visit
  with an empty list nothing is added. In Drive, the first sign-in (the folders are created) saves `BENIWEISS.json`;
  a later sign-in (the folders exist) adds nothing.
- `ACC-019` (GUI-020) The list is titled "My Recipes"; "New recipe" and "Upload recipe" come after the recipes;
  there is no "New from a sample recipe".

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
