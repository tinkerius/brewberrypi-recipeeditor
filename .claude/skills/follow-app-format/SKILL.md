---
name: follow-app-format
description: Bring the recipe editor in line with brewberrypi-app after the app changed its recipe file format, its schema or its shipped recipes.
argument-hint: "[brewberrypi-app commit or tag; default: its main]"
---

# Follow the app's recipe format

App commit: `$ARGUMENTS` (default: brewberrypi-app's `main`).

1. Read what changed in brewberrypi-app: `docs/specification/07-recipes.md` (§7.2.1 version table and migrators,
   `RCP-002` shipped recipes), `data/recipe.schema.json`, `data/recipes/`, and its open questions (`Q-nn`).
2. Check out brewberrypi-app at that commit and brewberrypi at the commit in `upstream.json` next to this
   repository, then run `scripts/sync-upstream.sh <app> <brewberrypi>`. Never edit `src/data/` by hand.
3. A new format version (app `RCP-011`):
   - raise `FORMAT_VERSION` in `src/model.ts`;
   - in `readRecipe`, read every older version as the app's migrators do (and say so when content changes, `FMT-003`);
   - follow the format in `serializeRecipe` (key order as the app writes it, `FMT-006`) and in `src/validate.ts`;
     `tests/validate.test.ts` compares the validator with the new schema through Ajv: add cases for what changed.
4. New or changed goal types or parameters: `src/model.ts` (`GOAL_TYPES`, `GOAL_INFO`, fields), `src/validate.ts`,
   the goal form (`src/ui/GoalEditor.tsx`) and `EDT-011`..`EDT-014`.
5. Update the specification (`FMT`, acceptance criteria, quoted texts) and the tests named after the ACCs; run
   `npm test` and `npm run build`.
6. Commit with the app's IDs (e.g. "follow app Q-34, RCP-007"). **Merge only after the app release that reads the
   new format is published** (`NFR-022`): the deployed editor must never write files the released app skips.
