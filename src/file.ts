/** Recipe files on the user's computer: upload (file input, drag and drop) and download. */

import { idFromFileName, serializeRecipe, toRecipe, type Recipe } from "./model";

export interface UploadedFile {
  fileName: string;
  id: string;
  recipe?: Recipe;
  /** Why the file could not be read; the recipe is then undefined. */
  error?: string;
}

export async function readRecipeFile(file: File): Promise<UploadedFile> {
  const id = idFromFileName(file.name);
  if (file.size > 1_000_000) {
    return { fileName: file.name, id, error: "The file is too large for a recipe." };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { fileName: file.name, id, error: "The file could not be read." };
  }
  try {
    return { fileName: file.name, id, recipe: toRecipe(JSON.parse(text)) };
  } catch (e) {
    return { fileName: file.name, id, error: `Not a JSON file: ${(e as Error).message}` };
  }
}

/** Saves "<id>.json" to the user's downloads. */
export function downloadRecipe(id: string, recipe: Recipe) {
  const blob = new Blob([serializeRecipe(recipe)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${id}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
