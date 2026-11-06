# 07 — User Interface

The look follows the BrewberryPi brand and the app's web UI (brand colours, Zilla Slab titles, light and dark mode).

## 7.1 Page

- `GUI-001` Top bar: the BrewberryPi logo, "Recipe Editor", and on the right "Cloud Sync" with **Sign in with
  Google** (Cloud Sync off), or "Cloud Sync: Google Drive · <e-mail address>" with **Sign out** (Cloud Sync on).
- `GUI-002` Below it the notices: the storage banner (`BRW-003`) with Cloud Sync off, or with Cloud Sync on the line
  "Cloud Sync is on: your recipes are files in your Google Drive, folder **BrewberryPi/recipes**. …" (and how to add
  files put there yourself); errors and information notices, each closable.
- `GUI-003` Two columns on wide screens (list left, recipe right), one column on phones; no horizontal scrolling at
  390 px width.
- `GUI-004` Footer: links to the privacy policy, the terms of use and the source code.
- `GUI-005` With no recipe selected, the right side explains what a recipe is, how to get it onto a BrewberryPi
  (`SCO-012`) and where recipes are kept.
- `GUI-006` Dropping files onto the page shows "Drop recipe files to open them" while dragging (`EDT-005`).

## 7.2 Sign-in button

- `GUI-010` **Sign in with Google** looks as Google's branding guidelines describe: Google's "G" logo, the text
  "Sign in with Google" in Roboto Medium, white with a grey border (dark grey in dark mode). The font is part of
  the page (`NFR-011`). In a build without Google settings the button is disabled and says why.

## 7.3 Recipe list

- `GUI-020` Title **My Recipes** (signed in and out, `QE-17`); the recipes; **below** them the buttons **New recipe**
  and **Upload recipe**, the hint that recipe files can be dropped onto the page, signed in the link
  **Add untracked file from cloud storage** (`GUI-023`).
- `GUI-021` Each recipe shows its name (or file name, or "Untitled recipe"), `<id>.json`, and the markers
  **incomplete** and **not downloaded** / **unsaved**.
- `GUI-022` Each recipe has a **menu** (`EDT-006`..`EDT-009`): Rename…, Duplicate…, Download, Delete…. It opens with
  the ⋯ button on the row (always visible on narrow screens and on the selected row, otherwise on hover) or a right
  click on the row; Escape closes it, arrow keys move in it.
- `GUI-023` Rare actions are shown as a **link** (text with the brand's berry underline, as the links on
  brewberrypi.org), not as a button: **Add untracked file from cloud storage** (`DRV-009`, an edge case, `QE-17`).

## 7.4 Recipe

- `GUI-030` Title: the recipe name; below it `<id>.json` (not editable here, `EDT-003`); the state (`BRW-004`,
  `DRV-010`) at the right. Then the recipe name field, the goals (`EDT-011`..`EDT-015`) and the problems
  (`EDT-020`).
- `GUI-031` Actions below: signed in **Save to Google Drive**; **Download `<id>.json`**; **Delete**.

## 7.5 States

- `GUI-040` A complete recipe with goals: "✓ Complete: BrewberryPi can load this recipe."
- `GUI-041` A complete recipe without goals: "✓ Valid recipe file. It has no goals yet, so BrewberryPi lists it but
  can't brew it."; the goals area says "No goals yet. Add them below; until then the BrewberryPi app lists this
  recipe but can't brew it."
- `GUI-042` Long operations (signing in, loading, saving) show a short status line; their buttons are disabled
  meanwhile.
