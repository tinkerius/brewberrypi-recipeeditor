# BrewberryPi Recipe Editor — Functional Specification (Index)

> **Scope:** *what* the recipe editor at https://recipes.brewberrypi.org does. Technology and architecture choices
> (Preact, Vite, Google Identity Services, …) are recorded in [docs/adr/](../adr/) (start with
> [ADR-0001](../adr/0001-architecture.md)), not here.
>
> **Source of truth for the recipe file format:** the specification of
> [brewberrypi-app](https://github.com/tinkerius/brewberrypi-app) (`docs/specification/07-recipes.md`,
> `04-goal-types.md`, `data/recipe.schema.json`). This specification says how the editor reads and writes that
> format; it never redefines it. App requirement IDs are cited as "app `RCP-007`".
>
> **Status:** written 2026-11-06 from the product owner's decisions and the editor as released then. Behaviour
> that is not decided yet is listed in [10 — Open Questions](10-open-questions.md) with its current default.

## Documents

| # | Document | Content |
|---|----------|---------|
| 01 | [Overview](01-overview.md) | Purpose, scope, actors, system context, glossary |
| 02 | [Recipe Files](02-recipe-files.md) | How the editor reads, checks and writes the app's recipe files |
| 03 | [Editing](03-editing.md) | Creating, opening, renaming, duplicating, deleting and editing recipes |
| 04 | [Browser Drafts](04-browser-drafts.md) | Signed out: recipes kept in this browser, and the warning about it |
| 05 | [Google Drive](05-google-drive.md) | Signed in: sign-in, folder layout, saving, conflicts, file picker, tabs |
| 06 | [Synchronisation](06-synchronisation.md) | Keeping the Drive recipe list current |
| 07 | [User Interface](07-user-interface.md) | Layout, list and menu, dialogs, notices |
| 08 | [Non-Functional Requirements](08-non-functional-requirements.md) | No backend, privacy, security, hosting, browsers, accessibility |
| 09 | [Acceptance Criteria](09-acceptance-criteria.md) | Testable scenarios, each with an automated test or marked manual |
| 10 | [Open Questions](10-open-questions.md) | Decisions still to be made by the product owner, and recorded answers |

## Requirement ID scheme

`<AREA>-<nnn>`, e.g. `DRV-007`. The areas differ from the app's, so an ID is never ambiguous:

| Prefix | Area | Document |
|--------|------|----------|
| `SCO` | Scope | 01 |
| `FMT` | Recipe files | 02 |
| `EDT` | Editing | 03 |
| `BRW` | Browser drafts | 04 |
| `DRV` | Google Drive | 05 |
| `SYN` | Synchronisation | 06 |
| `GUI` | User interface | 07 |
| `NFR` | Non-functional | 08 |
| `ACC` | Acceptance criteria | 09 |
| `QE` | Open questions | 10 |

Keywords **MUST**, **MUST NOT**, **SHOULD**, **MAY** are used as in RFC 2119. Requirement IDs are stable: never
renumber or reuse one; a new requirement takes the next free number of its prefix.
