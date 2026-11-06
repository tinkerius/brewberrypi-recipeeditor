# 05 — Google Drive (signed in)

## 5.1 Sign-in and access

- `DRV-001` **Sign in with Google** uses Google's browser sign-in for apps without a backend: a short-lived access
  token (about one hour) and no refresh token. The button follows Google's branding guidelines (`GUI-010`).
- `DRV-002` The editor asks only for Google's `drive.file` permission: access to the files the editor created or the
  user opened with it, nothing else in the Drive. If the user does not grant it, sign-in fails with a message
  asking to allow it.
  - A request that Google answers "not authorised" is repeated once with a renewed token; other Drive errors are
    shown with Google's message.
  - Renewing an expired token needs a click: Google's window opens (and usually closes at once). The editor never
    opens it without a click (`SYN-004`).
- `DRV-003` After sign-in the editor finds its folders, or creates them: **`BrewberryPi`** in the Drive's top level
  and **`recipes`** inside it. It recognises them by a marker (`appProperties.brewberrypi` = `root` / `recipes`),
  not by name, so renamed folders are still found; it creates each only once. The parent folder leaves room for
  more BrewberryPi data later (product owner, 2026-11-06).
- `DRV-004` The folders are visible in the user's Drive (not Drive's hidden app data), so the user can see, back up
  and share the recipe files (product owner, 2026-11-06).

## 5.2 Recipes in Drive

- `DRV-005` The list shows the `.json` files in `BrewberryPi/recipes` that the editor may see (`DRV-002`), not
  trashed. A recipe's content is read when it is first opened.
- `DRV-006` Saving is explicit (**Save to Drive**), only for complete recipes with pending changes (`FMT-010`). A new
  recipe is created as `<id>.json`; a file name already used in the folder is refused with a message.
- `DRV-007` Before overwriting, the editor checks that the file did not change in Drive since it was opened. If it
  did, it asks: **Overwrite**, **Save as a copy** (next free name, `EDT-004`; the original then shows Drive's
  version), **Discard my changes** (reload from Drive), or cancel.
- `DRV-008` Renaming and deleting: `EDT-006`, `EDT-008`. A file deleted or moved elsewhere is dropped from the list
  when it is opened, with a notice.
- `DRV-009` **Add untracked file from cloud storage** opens Google's file picker (JSON files, starting in the recipes folder). Picked
  files in the recipes folder are listed; files picked elsewhere are copied into it under a free name. This is how
  recipe files put into the folder some other way (drive.google.com, Drive for desktop) become visible to the
  editor (`DRV-002`).
- `DRV-010` A Drive recipe with pending changes is marked **unsaved**; the editor shows "Not saved to Drive yet",
  "Unsaved changes" or "Saved in Google Drive". Leaving the page asks first while there are unsaved changes.

## 5.3 Session

- `DRV-011` The access token is kept in the browser's local storage until it expires or the user signs out, so
  other tabs of the editor and reloads are signed in at once, without Google's window (product owner,
  2026-11-06). A stored token that no longer works is dropped without a message. Without local storage the token
  stays in the tab.
- `DRV-012` After an interactive sign-in, if the browser holds drafts, the editor offers to save them to Drive: per
  draft "Save", or for a name already in Drive "Save as a copy" / "Overwrite the Drive file", or "Keep in this
  browser"; incomplete drafts stay in the browser. Saved drafts are removed from the browser. A tab that signs in
  with a stored token (`DRV-011`) does not offer this again.
- `DRV-013` **Sign out** asks first if there are unsaved changes, then signs out in **every** tab: the token is
  removed and revoked at Google. Another open tab shows "You signed out in another tab." and shows the browser
  drafts again; a tab with unsaved changes keeps them and asks to sign in again to save them.
- `DRV-014` The e-mail address of the account is shown while signed in and remembered (until sign-out) to make the
  next sign-in quicker.
