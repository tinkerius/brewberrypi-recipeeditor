/** The 8 sample recipes shipped with the app (copied by scripts/sync-upstream.sh). */

import { idFromFileName, toRecipe, type Recipe } from "./model";

const files = import.meta.glob<{ default: unknown }>("./data/recipes/*.json", { eager: true });

export interface Sample {
  id: string;
  recipe: Recipe;
}

export const SAMPLES: Sample[] = Object.entries(files)
  .map(([path, module]) => ({ id: idFromFileName(path.split("/").pop() ?? path), recipe: toRecipe(module.default) }))
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
