/** The recipes shipped with the app (RCP-002), offered as samples (copied by scripts/sync-upstream.sh). */

import { idFromFileName, toRecipe, type Recipe } from "./model";

const files = import.meta.glob<{ default: unknown }>("./data/recipes/*.json", { eager: true });

export interface Sample {
  id: string;
  recipe: Recipe;
}

export const SAMPLES: Sample[] = Object.entries(files)
  .map(([path, module]) => ({ id: idFromFileName(path.split("/").pop() ?? path), recipe: toRecipe(module.default) }))
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The sample a new workspace gets once (EDT-016). */
export const FIRST_SAMPLE_ID = "BENIWEISS";

export function firstSample(): Sample | undefined {
  const sample = SAMPLES.find((s) => s.id === FIRST_SAMPLE_ID);
  return sample && { id: sample.id, recipe: structuredClone(sample.recipe) };
}
