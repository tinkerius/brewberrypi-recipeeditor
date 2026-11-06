# 01 — Overview

## 1.1 Purpose

- `SCO-001` The recipe editor lets brewers write recipes for BrewberryPi in a web browser: create them, open
  existing recipe files, edit the goals of the mashing process, and get files the BrewberryPi app loads unchanged
  (app `RCP-001`, `RCP-007`).
- `SCO-002` It is public, free and needs no account. Signed out, recipes are kept in the browser and downloaded as
  files (§4). With **Cloud Sync** (signed in with Google), they are files in the user's own Google Drive (§5).
- `SCO-003` It is a static web page: there is no BrewberryPi server, no backend and no BrewberryPi account
  (`NFR-001`). Everything runs in the user's browser; the only other party is Google, and only when the user signs in.

## 1.2 Out of scope

- `SCO-010` Editing recipes inside the BrewberryPi app (app `Q-09`: answered no).
- `SCO-011` Storage providers other than Google Drive (Microsoft OneDrive, Dropbox: possible later, `QE-02`).
  iCloud is not possible: it has no public API for iCloud Drive.
- `SCO-012` Transferring recipes to a BrewberryPi device; the editor never talks to a device. The device gets them
  either through the **app's Cloud Sync** (app spec 14, from app 0.1.0-alpha.13, `QE-03`): it copies the recipes of
  the Google Drive folder `BrewberryPi/recipes` that the editor writes, one way, from Google Drive to the device;
  or the brewer copies a downloaded file into the device's recipe folder (`\\<hostname>.local\config\app\recipes`,
  BrewberryPi OS file share).
- `SCO-013` Checking whether a recipe is a good or safe way to brew. The editor checks only the file format.

## 1.3 Actors and context

| Actor | Role |
|---|---|
| Brewer | Uses the editor in a browser, signed out or signed in with Google |
| Google | Sign-in (Google Identity Services), Google Drive (files), Google Picker (choosing files) |
| BrewberryPi app | Reads the recipe files the editor writes, through its Cloud Sync from Google Drive or as copied files (not connected to the editor) |
| GitHub Pages | Serves the editor's files |

## 1.4 Glossary

| Term | Meaning |
|---|---|
| Recipe file | One recipe as a JSON file `<id>.json` in the app's format (app spec 07) |
| Recipe id, file name | The file name without `.json`; letters, digits, `_` and `-` (app `RCP-001`) |
| Goal | One step of the mashing process (app spec 04), e.g. HeatUp, Rest |
| Draft | A recipe kept in the browser while signed out (§4) |
| Cloud Sync | Keeping the recipes in the user's own cloud storage (§5); provider today: Google Drive |
| Drive recipe | A recipe file in the user's Google Drive folder `BrewberryPi/recipes` (§5) |
| Sample | One of the recipes the app ships (app `RCP-002`); `BENIWEISS` is given to a new workspace (`EDT-016`) |
| Complete | Valid in the app's format, so the app lists it (it may still have no goals, app `Q-34`) |
| Pending changes | Changes not downloaded (draft) or not saved to Drive (Drive recipe) yet |
