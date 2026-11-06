# BrewberryPi Recipe Editor

Web editor for BrewberryPi brewing recipes: **https://recipes.brewberrypi.org**

BrewberryPi is a Raspberry Pi controller for a home-brewing mash kettle. It brews from recipes: JSON files, one per
recipe, in its recipe folder (`{"version": 2, "name": …, "mashing_process": {"goals": […]}}`; the goals may be empty,
then the app lists the recipe but can't brew it). The editor writes the
app's current format version. Files in the old format (goals at the top level) are converted when opened; files of a
newer format version are refused. This editor creates and edits those files in the browser. It is a static site on GitHub
Pages, with no backend.

- **Signed out:** create new recipes (they start empty), start from one of the app's shipped recipes (`BENIWEISS`,
  `WaterBoil`), or upload recipe files.
  You download each recipe as a file. Drafts are kept in the browser's storage (IndexedDB) until then. That storage is
  not safe: it is lost when browser data is cleared, in a private window, or in Safari after 7 days without a visit.
  The page says so in a banner.
- **Signed in with Google:** recipes are files in your own Google Drive, folder `BrewberryPi/recipes`. The editor
  uses Google's `drive.file` permission, so it sees only the files it created or that you picked in the Google Picker
  ("Add files from Drive"). On sign-in it offers to move the browser drafts to Drive.

To brew with a recipe, copy its file into the `app/recipes` folder of the BrewberryPi's file share
(`\\<hostname>.local\config`, see [brewberrypi-os](https://github.com/tinkerius/brewberrypi-os)). The app picks it up
within seconds.

## Related repositories

| Repository | Content |
|---|---|
| [brewberrypi-app](https://github.com/tinkerius/brewberrypi-app) | The application. Its specification defines the recipe format (`docs/specification/07-recipes.md`, `data/recipe.schema.json`) |
| [brewberrypi-os](https://github.com/tinkerius/brewberrypi-os) | The operating-system image (file share, updates) |
| [brewberrypi](https://github.com/tinkerius/brewberrypi) | The website https://brewberrypi.org and the brand (logo, colours, font) |

## Layout

| Path | Content |
|---|---|
| `index.html`, `src/main.tsx`, `src/App.tsx` | The editor page (Vite, Preact, TypeScript, Tailwind CSS v4, the same stack and look as the app's web UI) |
| `src/model.ts`, `src/validate.ts` | The recipe format: goal types, file formatting, validation without a JSON-schema library (strict Content-Security-Policy, no `eval`) |
| `src/doc.ts` | An open recipe: file name, content, saved/downloaded state |
| `src/store/BrowserStore.ts` | Signed-out drafts in IndexedDB (memory if the browser refuses) |
| `src/store/DriveStore.ts`, `src/auth/google.ts`, `src/drive/picker.ts` | Google Drive (v3 REST), sign-in (Google Identity Services token model), Google Picker |
| `src/ui/` | Components |
| `src/data/` | **Copies** of the recipe schema and the app's shipped recipes (the samples) from brewberrypi-app |
| `public/` | `CNAME`, privacy and terms pages, and **copies** of the brand logo, favicons and font from brewberrypi |
| `upstream.json` | The commits of brewberrypi-app and brewberrypi the copies come from |
| `scripts/sync-upstream.sh` | Copies those files again; `--check` (CI) fails if they differ |
| `tests/` | Vitest: validator (checked against Ajv and the schema), stores (fake IndexedDB, fake Drive), components |
| `docs/google-setup.md` | One-time setup: Google Cloud, domain, DNS, GitHub Pages, repository variables |

## Development

Node 22.

```bash
npm ci
```

```bash
npm run dev
```

Opens http://localhost:5173. Without Google settings the editor works signed out, and the sign-in button is disabled. To
sign in locally, put the values from `docs/google-setup.md` into `.env.local` (git-ignored):

```bash
VITE_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
VITE_GOOGLE_API_KEY=…
VITE_GOOGLE_APP_ID=…
```

Checks (CI runs the same):

```bash
npm test
```

```bash
npm run build
```

```bash
npm run preview
```

`npm run build` type-checks, then writes `dist/`. Only the built page carries the Content-Security-Policy
(`vite.config.ts`), so `npm run preview` is the way to check it.

### When the recipe format or the brand changes

Don't edit the copies in `src/data/` or the brand files in `public/`. Check out brewberrypi-app and brewberrypi next to
this repository at the commits you want, then:

```bash
scripts/sync-upstream.sh ../brewberrypi-app ../brewberrypi
```

The script copies the files and records the commits in `upstream.json`. A new goal type also needs `src/model.ts` and
`src/validate.ts`; the tests compare the goal types with the schema. A new recipe file format version (app spec
`RCP-011`) needs `FORMAT_VERSION`, `readRecipe` (convert older versions like the app's migrators), `serializeRecipe`
and the validator.

## Publishing

A push to `main` runs *Deploy to GitHub Pages* (`.github/workflows/pages.yml`): it runs the checks, builds with the
Google settings from the repository variables, and deploys to https://recipes.brewberrypi.org. Pull requests and other
branches run *CI* (`.github/workflows/ci.yml`). One-time setup: `docs/google-setup.md`.

## Privacy

There is no server: recipes stay in the browser or go straight from the browser to the user's Google Drive. See
`public/privacy.html` (https://recipes.brewberrypi.org/privacy.html).
