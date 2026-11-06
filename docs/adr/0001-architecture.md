# ADR-0001: Architecture of the recipe editor

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** product owner (tinkerius), Claude

## Context

A public web editor for BrewberryPi recipe files (`SCO-001`): signed out with recipes kept in the browser (`BRW`),
signed in with recipes in the user's own cloud storage (`DRV`), **without any backend** (`SCO-003`, `NFR-001`), at
https://recipes.brewberrypi.org (`NFR-020`). The recipe format is the app's (`FMT-001`). The decisions below were
made on 2026-11-06 while the editor was built; this record collects them with their reasons.

## Decisions

### 1. Static site on GitHub Pages, own repository

- **Options:** a page in the website repository `tinkerius/brewberrypi`; a page in the app repository; an own
  repository.
- **Decision:** own repository `tinkerius/brewberrypi-recipeeditor`, GitHub Pages with the custom domain
  `recipes.brewberrypi.org` (GitHub Pages allows one site per repository; brewberrypi.org is the website's).
- **Consequence:** the schema, sample recipes and brand files are copies, pinned to commits in `upstream.json` and
  checked in CI (`NFR-030`); `scripts/sync-upstream.sh` updates them.

### 2. Stack like the app's web UI

- **Decision:** Vite, Preact, TypeScript, Tailwind CSS v4, Vitest (as brewberrypi-app ADR-0001), brand colours and
  Zilla Slab from the brand; Roboto (bundled, `@fontsource/roboto`) only for the Google button (`GUI-010`).

### 3. Storage provider: Google Drive only

- **Options:** Google Drive, Microsoft OneDrive, Dropbox, iCloud.
- **Findings:** Google, OneDrive and Dropbox work from a browser page without a backend (OAuth for public clients,
  CORS). iCloud has no public API for iCloud Drive ("Sign in with Apple" gives identity only).
- **Decision:** Google Drive only for now (product owner); others behind the same store interface later (`QE-02`).

### 4. Google sign-in: token model in the browser

- **Options:** Google Identity Services token model (client id only, access token about 1 h, no refresh token);
  authorization-code flow (needs a client secret, i.e. a backend).
- **Decision:** token model. Renewing after the hour needs a click, because it opens Google's window (`DRV-002`).
- **Session (`DRV-011`):** the token is kept in localStorage until it expires or sign-out, so tabs and reloads stay
  signed in; sign-out in one tab signs out all (storage event). Product owner's decision; the risk is limited by the
  short lifetime, the narrow permission and the strict CSP.

### 5. Drive permission `drive.file` and the Google Picker

- **Options:** `drive.file` (files the app created or the user opened with it; non-sensitive, no security
  assessment); `drive` / `drive.readonly` (whole Drive; restricted, yearly CASA assessment).
- **Decision:** `drive.file` (`NFR-010`); files put into the folder by other means become visible through the
  Picker (`DRV-009`, `QE-04`).

### 6. Visible Drive folder `BrewberryPi/recipes`

- **Options:** Drive's hidden `appDataFolder`; a visible folder; a dot folder `.brewberrypi`.
- **Decision:** visible `BrewberryPi/recipes` (product owner): users see and back up their files. A dot folder is not
  hidden in Drive (only by Drive for desktop on macOS/Linux). The folders are found by `appProperties` markers,
  not by name (`DRV-003`). The layout stays stable for the app's future Drive sync (`QE-03`).

### 7. Signed-out drafts in IndexedDB

- **Options:** memory only (lost on reload); IndexedDB (kept, but can be cleared by the browser).
- **Decision:** IndexedDB with `navigator.storage.persist()`, memory as fallback, and a permanent warning that the
  storage can be lost (`BRW-001`..`BRW-003`, product owner).

### 8. Keeping the Drive list current: polling Drive's changes feed

- **Options:** Drive push notifications (`changes.watch`: POSTs to a public HTTPS webhook, i.e. a backend); polling
  the whole folder; polling Drive's changes feed.
- **Decision:** changes feed every 10 s while the page is visible, full list on a relevant change and every 5 min
  (`SYN-002`); no reload button (product owner).

### 9. Validation without a JSON-schema library at run time

- **Options:** a schema validator library (Ajv compiles schemas with `new Function`, which a strict CSP forbids);
  a hand-written validator.
- **Decision:** hand-written `src/validate.ts`, checked against Ajv and the app's schema in the tests (`FMT-004`,
  `ACC-001`); strict Content-Security-Policy (`NFR-011`).

## Consequences

- Positive: no server to run or secure; recipes stay with the user; the editor deploys with a merge.
- Negative / risks: sign-in lasts about an hour (then a click); signed-out drafts can be lost (warned); Drive
  changes appear with up to 10 s delay; Google's consent screen must be configured and published (`QE-05`).
- Follow-ups: other providers (`QE-02`); the app's Drive sync (`QE-03`). A new technology or architecture decision
  gets its own ADR (copy `0000-template.md`).
