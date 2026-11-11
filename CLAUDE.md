# BrewberryPi Recipe Editor

Static web editor for BrewberryPi recipe files, published with GitHub Pages at https://recipes.brewberrypi.org. There is
no backend. Signed-out users keep drafts in the browser (IndexedDB) and download files. Signed-in users (Google) keep
recipes in their Google Drive, `BrewberryPi/recipes/<id>.json`, with scope `drive.file`. The behaviour is specified in
`docs/specification/` (`00-index.md` first); technology and architecture decisions are in `docs/adr/` (ADR-0001);
`README.md` describes the layout and commands; `docs/google-setup.md` the one-time setup.

## Related repositories

- `tinkerius/brewberrypi-app`: the application. Its specification is the source of truth for the recipe format:
  `docs/specification/07-recipes.md` (file name = recipe id `[A-Za-z0-9_-]+`, one recipe per file; format
  `{"version": 3, "name", "mashing_process": {"goals"}, "mashing", "ingredients", "batch", "water"}`, goals possibly
  empty `Q-34`, the mashing plan `mashing` keyed by rest id `RCP-012`/`Q-37`, the `ingredients` `malts` (`name`, `grams`,
  `ebc`), `hops` (`name`, `grams`, `alpha`, `minutes`) and `others` (`name`, `grams`, `minutes`)
  `RCP-013`/`Q-38`/`Q-39`/`Q-42`, the `batch` (`liters` = knockout
  volume, `plato`, `final_plato`) `RCP-014`, the `water` (`mash`, `sparge`, `top_up`, litres) `RCP-015`/`Q-40`, version and migration
  `RCP-007..011`),
  `04-goal-types.md`, and `data/recipe.schema.json`. The samples are exactly the app's shipped recipes (`RCP-002`).
- `tinkerius/brewberrypi`: the website brewberrypi.org and the brand (`brand/README.md`: colours, logo, font).
- `tinkerius/brewberrypi-os`: the OS image; recipes reach the device through its file share
  (`\\<hostname>.local\config\app\recipes`).
- The app's Cloud Sync (its spec 14, ADR-0003) reads the Drive folder the editor writes, one way, with its own device
  client in the same Google Cloud project. Keep the Drive layout (`BrewberryPi/recipes`, the folders'
  `appProperties.brewberrypi` = `root`/`recipes`, file format as written by `serializeRecipe`) stable for it.

## Commands

- Setup: `npm ci`
- Dev server: `npm run dev` (http://localhost:5173, the origin registered with Google)
- Test: `npm test` (Vitest)
- Build: `npm run build` (type-check + Vite into `dist/`); `npm run preview` serves it with the CSP
- Upstream copies: `scripts/sync-upstream.sh [--check] ../brewberrypi-app ../brewberrypi`
- Skills: `/spec-question` (record a specification question), `/verify-spec [prefix]` (coverage report),
  `/follow-app-format [app commit]` (after the app changed its recipe format or shipped recipes)

## Rules

- The specification (`docs/specification/`) is the single source of truth for what the editor does; for the recipe
  file format it is brewberrypi-app's specification. If a request changes specified behaviour, or the
  specification is ambiguous or seems wrong, record it with `/spec-question` and get the product owner's answer
  before changing code; then change the specification, the acceptance criteria and the tests together.
- A new technology or architecture decision (library, storage, provider, Google permission, hosting) gets an ADR in
  `docs/adr/` (copy `0000-template.md`) before the code.
- Every acceptance criterion (`09-acceptance-criteria.md`, `ACC-nnn`) gets a test whose name starts with its ID,
  unless it is marked *manual* (`tests/spec.test.ts` checks this). Commit messages reference the requirement or
  ACC IDs they implement.
- Recipe files must load in the app unchanged: validate with `src/validate.ts` before any save or download. It must
  agree with the schema (`tests/validate.test.ts` checks this against Ajv). Never save or download an invalid recipe.
- `src/data/` and the brand files in `public/` are copies: change them upstream and run the sync script, never by hand.
- Recipe texts are data: keep the samples' legacy spellings (app question `Q-07`).
- Only the app's shipped recipes are samples. Never add other recipes (e.g. the product owner's personal ones,
  app `Q-32`) to this repository, not even in tests.
- The editor writes the app's latest recipe format version (`FORMAT_VERSION` in `src/model.ts`), converts older
  files when it reads them (and says so), and refuses newer versions instead of dropping what it doesn't know. When
  the app raises the version (`RCP-011`), follow it with `/follow-app-format`, and merge only after the app release
  that reads it (`NFR-022`).
- Privacy: no backend, no analytics, no third-party storage. The only localStorage entries are the Google access
  token (until it expires, about an hour, or sign-out; shared by the editor's tabs, product owner's decision), the
  sign-in hint (e-mail) and whether the recipe list is collapsed (`QE-29`). Update `public/privacy.html` and brewberrypi's `site/privacy.html` when what the
  editor stores or sends changes.
- Content-Security-Policy (`vite.config.ts`): only the page itself and Google. No `eval`, no new third-party origins.
- Scope stays `drive.file` (non-sensitive). Broader Drive scopes need Google's restricted-scope verification.
- Warn about data that can be lost: the signed-out banner, the "not downloaded"/"unsaved" markers and the
  `beforeunload` prompt stay.
- Same stack as brewberrypi-app's web UI (Preact, Tailwind v4); the look follows the website brewberrypi.org (`QE-27`:
  its top bar, footer, background, buttons and titles; brand colours in `src/styles.css`), plus a dark mode.
- Commit messages say what changed and why. Pull requests target `main`; a merge deploys.
