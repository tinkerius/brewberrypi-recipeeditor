# 10 — Open Questions

Decisions for the product owner. Each question states the **current default** (what the editor does until it is
answered). Record answers here and update the affected sections; do not change behaviour silently.

| ID | Question | Current default | Affects |
|---|---|---|---|
| `QE-01` | Does the site need an imprint (Impressum: name and address of the person responsible), e.g. under German law? | No imprint; contact through GitHub issues. | `NFR-004` |
| `QE-02` | Other storage providers (Microsoft OneDrive, Dropbox) besides Google Drive? | Google Drive only (product owner, 2026-11-06). | `SCO-011` |
| `QE-03` | When the BrewberryPi app syncs with Google Drive (future work in brewberrypi-app): does it use the same folder `BrewberryPi/recipes` and Google project, and must the editor change anything? | The folder layout and markers (`DRV-003`) and the file format (`FMT-006`) stay stable for it. | `DRV-003`, `SYN` |
| `QE-04` | Recipe files put into the Drive folder by hand are only visible after "Add files from Drive" (`drive.file`). Should the editor see the whole folder (needs a broader permission and Google's security assessment)? | No: `drive.file` and the file picker. | `DRV-002`, `DRV-009`, `NFR-010` |
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
