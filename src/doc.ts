/** An open recipe in the editor: its file name (id), its content and where it was last saved or downloaded. */

import { serializeRecipe, type Recipe } from "./model";
import { validateId, validateRecipe, type Problem } from "./validate";

export interface Doc {
  /** Unique in the editor: a random key for a draft, the Drive file id for a Drive recipe. */
  key: string;
  /** The recipe id = the file name without ".json". Empty for a new recipe. */
  id: string;
  recipe: Recipe;
  /**
   * fingerprint() at the last download (browser drafts) or at the last load or save (Drive). Undefined when it was
   * never downloaded or saved.
   */
  baseline?: string;
  /** Drive only: the file and its version when it was loaded or saved. */
  fileId?: string;
  version?: string;
  /** Drive only: false while only the file name is known and the content still has to be read. */
  loaded: boolean;
  /** Drive only: why the file's content could not be used (not JSON, newer format); the recipe is then empty. */
  loadError?: string;
  /** What the editor changed when it read the file (old format converted); shown until saved or downloaded. */
  notice?: string;
  /** Time of the last change (ms since 1970), for the list order. */
  updatedAt: number;
}

export function fingerprint(doc: Pick<Doc, "id" | "recipe">): string {
  return `${doc.id}\n${serializeRecipe(doc.recipe)}`;
}

/** True when the doc has changes that are not downloaded (browser) or not saved (Drive). */
export function hasPendingChanges(doc: Doc): boolean {
  return doc.loaded && doc.baseline !== fingerprint(doc);
}

export function problemsOf(doc: Doc): Problem[] {
  return [...validateId(doc.id), ...validateRecipe(doc.recipe)];
}

export function randomKey(): string {
  return `draft-${crypto.randomUUID()}`;
}

export function newDoc(id: string, recipe: Recipe): Doc {
  return { key: randomKey(), id, recipe, loaded: true, updatedAt: Date.now() };
}

/** A file name that is not taken yet: "Weizen" -> "Weizen-2", "Weizen-3", ... */
export function freeId(id: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(id)) {
    return id;
  }
  for (let n = 2; ; n++) {
    const candidate = `${id}-${n}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }
}

/** Display name in the list. */
export function titleOf(doc: Doc): string {
  return doc.recipe.name.trim() || (doc.id ? doc.id : "Untitled recipe");
}
