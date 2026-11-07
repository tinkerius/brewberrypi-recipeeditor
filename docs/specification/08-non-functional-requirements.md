# 08 — Non-Functional Requirements

## 8.1 No backend, privacy

- `NFR-001` The editor is a static web page: no BrewberryPi server, backend, database or account. Recipes and Google
  account data never pass through BrewberryPi.
- `NFR-002` The editor stores only, in the user's browser: drafts (`BRW-001`), the Google access token until it
  expires or sign-out (`DRV-011`), the account's e-mail address as a sign-in hint (`DRV-014`) and whether the recipe
  list is collapsed (`GUI-024`). No cookies of its
  own, no analytics, no tracking, no third-party storage.
- `NFR-003` Data from Google is used only to show and save the user's recipes, as the Google API Services User Data
  Policy (Limited Use) requires; it is not shared, sold, used for advertising or to train AI models.
- `NFR-004` The privacy policy and terms of use are published on the verified domain brewberrypi.org
  (`https://brewberrypi.org/privacy.html`, `/terms.html`, the URLs on Google's consent screen) and on the editor's
  own site. They MUST be updated when what the editor stores or sends changes.

## 8.2 Security

- `NFR-010` Drive permission: only `drive.file` (`DRV-002`), a non-sensitive permission without Google's security
  assessment. A broader permission needs a product-owner decision first.
- `NFR-011` The page loads code only from itself and from Google (sign-in, Drive, file picker), enforced by a
  Content-Security-Policy; no code is evaluated from text. Fonts, logos and styles are part of the page.
- `NFR-012` No secrets in the page: the Google client id, API key (restricted to the file picker and the editor's
  addresses) and project number are public values.

## 8.3 Hosting and deployment

- `NFR-020` The editor is served by GitHub Pages at **https://recipes.brewberrypi.org** (HTTPS only). A change to the
  main branch is deployed after the checks pass (`NFR-030`).
- `NFR-021` Google's settings (client, consent screen, domain verification) are described in `docs/google-setup.md`.
- `NFR-022` A release of the editor that writes a new recipe file format version (`FMT-009`) MUST NOT be deployed
  before the BrewberryPi app release that reads it.

## 8.4 Quality

- `NFR-030` Every change is checked automatically: the tests, the type check, the build, and that the copies of
  the app's schema and shipped recipes and of the brand files are unchanged from the commits they were taken from.
- `NFR-031` Every acceptance criterion (§9) has an automated test whose name starts with its ID, unless it is
  marked *manual*; a test fails when an automated criterion has no test.
- `NFR-032` Current versions of Chrome, Edge, Firefox and Safari, on desktop and phone; layout from 390 px width.
- `NFR-033` Light and dark mode follow the system setting. Controls are reachable by keyboard and have accessible
  names; dialogs are modal and focus their first field.
