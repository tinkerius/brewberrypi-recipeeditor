# 07 — User Interface

The look follows the website brewberrypi.org (`QE-27`): its dark top bar and footer bands, its content width (at most
1180 px), page background with the faint measuring grid fading out from the top, white cards with a thin border, buttons (the main one pink with dark text, the others outlined) and Zilla Slab Bold titles,
in the brand colours. Unlike the website, the editor also has a dark mode, following the system setting.

## 7.1 Page

- `GUI-001` Top bar, a dark band over the full width as on the website: the BrewberryPi mark and "Brewberry**Pi**"
  (a link to https://brewberrypi.org/), "Recipe Editor", and on the right "Cloud Sync" with **Sign in with
  Google** (Cloud Sync off), or "Cloud Sync: Google Drive · <e-mail address>" with **Sign out** (Cloud Sync on).
- `GUI-002` Below it the notices: the storage banner (`BRW-003`) with Cloud Sync off; errors and information notices,
  each closable. With Cloud Sync on there is no notice: where the recipes are is a hint in the recipe list
  (`GUI-020`, `QE-30`).
- `GUI-003` Two columns on wide screens (list left, recipe right), one column on phones; no horizontal scrolling at
  390 px width. The list can be collapsed (`GUI-024`); then the recipe takes the width.
- `GUI-004` Footer, a dark band as on the website: the BrewberryPi logo and links to brewberrypi.org, the privacy
  policy, the terms of use and the source code.
- `GUI-005` With no recipe selected, the right side explains what a recipe is, how to get it onto a BrewberryPi
  (`SCO-012`) and where recipes are kept.
- `GUI-006` Dropping files onto the page shows "Drop recipe files to open them" while dragging (`EDT-005`).

## 7.2 Sign-in button

- `GUI-010` **Sign in with Google** looks as Google's branding guidelines describe: Google's "G" logo, the text
  "Sign in with Google" in Roboto Medium, in Google's dark theme (dark grey with a grey border) on the dark top bar. The font is part of
  the page (`NFR-011`). In a build without Google settings the button is disabled and says why.

## 7.3 Recipe list

- `GUI-020` Title **My Recipes** (signed in and out, `QE-17`); the recipes; **below** them the buttons **New recipe**
  and **Upload recipe**, the hint that recipe files can be dropped onto the page, signed in the link
  **Add untracked file from cloud storage** (`GUI-023`) and below it the small hint "Your recipes are files in your
  Google Drive, folder **BrewberryPi/recipes**. Files you put there yourself appear after you add them with this
  link." (`QE-30`).
- `GUI-021` Each recipe shows its name (or file name, or "Untitled recipe"), `<id>.json`, and the markers
  **incomplete** and **not downloaded** / **unsaved**.
- `GUI-022` Each recipe has a **menu** (`EDT-006`..`EDT-009`): Rename…, Duplicate…, Download, Delete…. It opens with
  the ⋯ button on the row (always visible on narrow screens and on the selected row, otherwise on hover) or a right
  click on the row; Escape closes it, arrow keys move in it.
- `GUI-023` Rare actions are shown as a **link** (text with the brand's berry underline, as the links on
  brewberrypi.org), not as a button: **Add untracked file from cloud storage** (`DRV-009`, an edge case, `QE-17`).
- `GUI-024` The recipe list is a **collapsible sidebar** (`QE-29`), like the sidebar in Claude Code. A sidebar button
  in its title row ("Hide sidebar" / "Show sidebar", tooltip with the shortcut) and **Ctrl+B** (⌘B on a Mac),
  anywhere on the page but not while a dialog is open, collapse and expand it. Collapsed on a wide screen, it is a
  narrow strip with the sidebar button and a **New recipe** button (+); on a phone, only its title row with the number
  of recipes. While collapsed, a dot on it says how many recipes are not downloaded / unsaved (`BRW-004`, `DRV-010`),
  so changes that can be lost stay visible. The browser remembers a collapsed list (`NFR-002`); expanding it forgets
  it again.

## 7.4 Recipe

- `GUI-030` Title: the recipe name, editable in place (`EDT-010`; "Untitled recipe" while it has none); the file
  name `<id>.json` is not repeated below it (it is in the recipe list, `GUI-021`; `QE-49`); the state (`BRW-004`,
  `DRV-010`) at the right. Then the tabs (`GUI-032`), and below them the problems (`EDT-020`).
- `GUI-032` The recipe's sections are **tabs** below its title (`QE-28`). So far there are seven, in this order (`QE-43`,
  `QE-55`, `QE-56`): **Overview** (selected when a recipe is opened): the description (`EDT-065`); **Malt**: the
  malts (`EDT-041`..`EDT-050`, `QE-34`, `QE-35`); **Mashing**: the mashing plan (`EDT-030`..`EDT-035`, `QE-32`);
  **Boiling**: the hops and other additions (`EDT-041`..`EDT-054`, `EDT-060`, `QE-42`); **Water**: the
  brewing-day water and the knockout volume (`EDT-051`..`EDT-053`, `QE-36`); **Fermentation**: the gravity, the
  yeast and the carbonation (`EDT-057`, `EDT-066`); and **Mash Process**: the goals in brewing order, one line each
  with one open for editing (`EDT-011`..`EDT-015`, `QE-26`), and **+ Add goal**. Each tab shows its errors and
  warnings (`EDT-063`).
  The problems, notices and actions are below the tabs, for the whole recipe. The tabs follow the ARIA tab pattern
  (tab list, selected tab, panel; the arrow keys move between tabs).
- `GUI-031` Actions below, signed in: **Save to Google Drive** and **Discard changes** (`DRV-006`). Download and
  Delete are only in the recipe's menu (`GUI-022`, `QE-22`).

## 7.5 States

- `GUI-040` A complete recipe with goals: "✓ Complete: BrewberryPi can load this recipe."
- `GUI-041` A complete recipe without goals: "✓ Valid recipe file. It has no goals yet, so BrewberryPi lists it but
  can't brew it."; the goals area says "No goals yet. Add them below; until then the BrewberryPi app lists this
  recipe but can't brew it."
- `GUI-042` Long operations (signing in, loading, saving) show a short status line; their buttons are disabled
  meanwhile.
