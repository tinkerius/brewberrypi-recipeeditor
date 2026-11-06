# 10 — Open Questions

Decisions for the product owner. Each question states the **current default** (what the editor does until it is
answered). Record answers here and update the affected sections; do not change behaviour silently.

| ID | Question | Current default | Affects |
|---|---|---|---|
| `QE-01` | Does the site need an imprint (Impressum: name and address of the person responsible), e.g. under German law? | No imprint; contact through GitHub issues. | `NFR-004` |
| `QE-02` | Other storage providers (Microsoft OneDrive, Dropbox) besides Google Drive? | Google Drive only (product owner, 2026-11-06). | `SCO-011` |
| `QE-04` | Recipe files put into the Drive folder by hand are only visible after "Add untracked file from cloud storage" (`drive.file`). Should the editor see the whole folder (needs a broader permission and Google's security assessment)? | No: `drive.file` and the file picker. | `DRV-002`, `DRV-009`, `NFR-010` |
| `QE-05` | Google's consent screen is in *Testing*: only listed test users can sign in. When is it published, and with brand verification (logo)? | Not decided; the editor works either way. | `DRV-001` |

## Answered

| ID | Question | Answer | Affects |
|---|---|---|---|
| `QE-10` | Public editor only, or also in the app? | **2026-11-06:** public web editor only; the app has none (app `Q-09`). | `SCO-001`, `SCO-010` |
| `QE-11` | Where are signed-in recipes stored? | **2026-11-06:** the user's Google Drive, visible folder `BrewberryPi/recipes` (not hidden app data; the parent folder leaves room for more). | `DRV-003`, `DRV-004` |
| `QE-12` | What do signed-out users get? | **2026-11-06:** create, upload, edit and download recipes; kept in the browser with a clear warning that this storage can be lost. | `BRW-001`..`BRW-008` |
| `QE-13` | Recipes without goals? | **2026-11-06:** allowed (app `Q-34`, format version 2). | `FMT-001`, `FMT-010` |
| `QE-14` | How does the list stay current? | **2026-11-06:** automatically, no reload button; within about 10 s (Drive's changes feed; push needs a server). | `SYN-001`..`SYN-004` |
| `QE-15` | Where is the file name entered? | **2026-11-06:** only when a recipe is created or renamed, in a dialog; rename and duplicate in a menu on each recipe in the list. | `EDT-003`, `EDT-006`, `EDT-007`, `GUI-022` |
| `QE-16` | New tabs signed in? | **2026-11-06:** yes, the token is kept in the browser's local storage until it expires or sign-out; sign-out applies to all tabs. | `DRV-011`, `DRV-013`, `NFR-002` |
| `QE-17` | Layout of the recipe list, and how do new users get an example? | **2026-11-06:** the list is titled "My Recipes" (signed in and out); its buttons are below the list; "Upload files" is "Upload recipe"; "New from a sample recipe" is removed; instead an empty workspace gets the sample `BENIWEISS` once: at the first sign-in (when the Drive folder is created) and on the first visit in a browser; "Add files from Drive" is an edge case: "Add untracked file from cloud storage", shown as a link. | `EDT-002`, `EDT-005`, `EDT-016`, `GUI-020`, `GUI-023`, `DRV-009` |
| `QE-18` | What is the feature called in the UI? | **2026-11-06:** "Cloud Sync"; the provider is "Google Drive" (the only one so far), always named in full. Google's own button keeps its text "Sign in with Google" (branding guidelines). | `GUI-001`, `GUI-002`, `BRW-003`, `DRV-006`, `DRV-010`, `DRV-012`, `GUI-031` |
| `QE-19` | Is "Delete all recipes in this browser" needed? | **2026-11-06:** no, removed; single recipes are deleted from their menu. | `BRW-006`, `GUI-020` |
| `QE-20` | How are goals reordered? | **2026-11-06:** by drag and drop (mouse and touch) with a handle on each goal, and the arrow keys on the handle for the keyboard; the move-up/move-down arrow buttons are removed. | `EDT-012` |
| `QE-21` | Where is the recipe name edited? | **2026-11-06:** in the title (click the name or the pencil next to it), not in a second field below it. | `EDT-010`, `GUI-030` |
| `QE-22` | Download and Delete buttons below the recipe, besides the menu? | **2026-11-06:** no, removed; both are in the recipe's menu. Signed in, Save to Google Drive stays. | `GUI-031` |
| `QE-23` | How is a goal's type chosen? | **2026-11-06:** in a dialog: when a goal is added ("+ Add goal" asks for the type) and with a pencil next to the type of each goal, like the recipe name; no type dropdowns in the goal list. | `EDT-011`, `EDT-012`, `EDT-014`, `EDT-017` |
| `QE-03` | When the BrewberryPi app syncs with Google Drive: does it use the same folder `BrewberryPi/recipes` and Google project, and must the editor change anything? | **2026-11-06** (app `Q-35`, app spec 14, ADR-0003 of the app, released in app 0.1.0-alpha.13): yes, one way from Google Drive to the device. The app reads `BrewberryPi/recipes`, found by the editor's markers (`DRV-003`), with `drive.file` through its own device client in the same Google Cloud project; it never writes to Google Drive. While it is on, the device's recipe folder mirrors the Drive folder, so recipes deleted in the editor (`EDT-008`) leave the device too. The editor changes nothing but its texts; the folder layout, markers and file format stay stable for the app. | `SCO-012`, `DRV-003`, `GUI-005`, `NFR-004` |
