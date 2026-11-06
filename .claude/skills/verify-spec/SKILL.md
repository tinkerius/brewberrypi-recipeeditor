---
name: verify-spec
description: Check the recipe editor against its specification's requirements and acceptance criteria, and report coverage gaps. Read-only.
argument-hint: "[requirement prefix, e.g. FMT, DRV, SYN — empty for all]"
---

# Verify the editor against the specification

Scope: `$ARGUMENTS` (a requirement prefix; empty means everything).

1. Collect the requirement IDs (`FMT`, `EDT`, `BRW`, `DRV`, `SYN`, `GUI`, `NFR`, `SCO`) and acceptance criteria
   (`ACC-nnn`) in scope from `docs/specification/`.
2. For each one, find the implementing code and its tests, and classify it as **covered and tested**,
   **implemented but untested**, **missing** or **deviates**. User-visible texts quoted in the specification must
   match the code verbatim.
3. Check the recipe format against brewberrypi-app's specification (`07-recipes.md`, `data/recipe.schema.json`):
   `FORMAT_VERSION` in `src/model.ts` is the app's latest version, and `upstream.json` points at the app commit the
   copies in `src/data/` come from (`scripts/sync-upstream.sh --check <app> <brewberrypi>`).
4. Check the privacy and security rules explicitly (`NFR-001`..`NFR-012`): no backend, only the localStorage entries
   `NFR-002` names, scope `drive.file` only, the Content-Security-Policy in `vite.config.ts` (page and Google only,
   no `eval`), and that `public/privacy.html` and brewberrypi's `site/privacy.html` describe what the editor stores
   and sends.
5. Run `npm test` (includes `tests/spec.test.ts`: every automated ACC has a test) and `npm run build`; include the
   results.
6. Report a table sorted by severity: privacy/security, missing, deviates, untested. List the *manual* criteria
   (`ACC-050`..) as to be checked by hand. Do not change code unless the user asks.
