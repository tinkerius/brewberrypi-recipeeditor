# BrewberryPi Recipe Editor

Static web editor for BrewberryPi recipe files, published with GitHub Pages at https://recipes.brewberrypi.org. There is
no backend. Signed-out users keep drafts in the browser (IndexedDB) and download files. Signed-in users (Google) keep
recipes in their Google Drive, `BrewberryPi/recipes/<id>.json`, with scope `drive.file`. `README.md` describes the
layout and commands; `docs/google-setup.md` the one-time setup.

## Related repositories

- `tinkerius/brewberrypi-app`: the application. Its specification is the source of truth for the recipe format:
  `docs/specification/07-recipes.md` (file name = recipe id `[A-Za-z0-9_-]+`, one recipe per file; format
  `{"version": 2, "name", "mashing_process": {"goals"}}`, goals possibly empty `Q-34`, version and migration
  `RCP-007..011`),
  `04-goal-types.md`, and `data/recipe.schema.json`. The samples are exactly the app's shipped recipes (`RCP-002`).
- `tinkerius/brewberrypi`: the website brewberrypi.org and the brand (`brand/README.md`: colours, logo, font).
- `tinkerius/brewberrypi-os`: the OS image; recipes reach the device through its file share
  (`\\<hostname>.local\config\app\recipes`).
- Device sync with Google Drive is future work in brewberrypi-app. Keep the Drive layout (`BrewberryPi/recipes`, the
  folders' `appProperties.brewberrypi` = `root`/`recipes`, file format as written by `serializeRecipe`) stable for it.

## Commands

- Setup: `npm ci`
- Dev server: `npm run dev` (http://localhost:5173, the origin registered with Google)
- Test: `npm test` (Vitest)
- Build: `npm run build` (type-check + Vite into `dist/`); `npm run preview` serves it with the CSP
- Upstream copies: `scripts/sync-upstream.sh [--check] ../brewberrypi-app ../brewberrypi`

## Rules

- Recipe files must load in the app unchanged: validate with `src/validate.ts` before any save or download. It must
  agree with the schema (`tests/validate.test.ts` checks this against Ajv). Never save or download an invalid recipe.
- `src/data/` and the brand files in `public/` are copies: change them upstream and run the sync script, never by hand.
- Recipe texts are data: keep the samples' legacy spellings (app question `Q-07`).
- Only the app's shipped recipes are samples. Never add other recipes (e.g. the product owner's personal ones,
  app `Q-32`) to this repository, not even in tests.
- The editor writes the app's latest recipe format version (`FORMAT_VERSION` in `src/model.ts`), converts older
  files when it reads them (and says so), and refuses newer versions instead of dropping what it doesn't know. When
  the app raises the version (`RCP-011`), follow it in the same way.
- Privacy: no backend, no analytics, no third-party storage. The Google access token stays in memory; the only
  localStorage entry is the sign-in hint (e-mail). Update `public/privacy.html` when what the editor stores or sends
  changes.
- Content-Security-Policy (`vite.config.ts`): only the page itself and Google. No `eval`, no new third-party origins.
- Scope stays `drive.file` (non-sensitive). Broader Drive scopes need Google's restricted-scope verification.
- Warn about data that can be lost: the signed-out banner, the "not downloaded"/"unsaved" markers and the
  `beforeunload` prompt stay.
- Same stack and look as brewberrypi-app's web UI (Preact, Tailwind v4, brand colours in `src/styles.css`).
- Commit messages say what changed and why. Pull requests target `main`; a merge deploys.
