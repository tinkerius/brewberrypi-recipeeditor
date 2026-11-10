/**
 * Keeps the recipe list of a signed-in user in step with Google Drive: the list is read after sign-in and again
 * whenever the folder changed elsewhere (the editor in another tab or on another device, drive.google.com). Drive
 * can push change notifications only to a server (a webhook), and this editor has none, so it asks Drive's changes
 * feed every few seconds instead: an answer without changes is small, and only a relevant change reads the list
 * again. Changes the user has not saved are never thrown away.
 */

import { hasPendingChanges, type Doc } from "./doc";
import { emptyRecipe } from "./model";
import type { DriveFile } from "./store/DriveStore";

/** How often Drive's changes feed is asked while the page is visible. */
export const CHANGE_POLL_MS = 10_000;

/** How often the whole list is read anyway, in case a change was missed. */
export const FULL_SYNC_MS = 300_000;

/** One entry of Drive's changes feed (changes.list). */
export interface DriveChange {
  fileId: string;
  removed?: boolean;
  file?: { parents?: string[]; trashed?: boolean };
}

/** Runs task for every item, at most limit at a time (DRV-005: the recipes are read a few at a time). */
export async function inPool<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      await task(items[next++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** A change matters if it concerns a listed recipe (edited, renamed, trashed, moved away) or a file in the folder. */
export function isRelevantChange(change: DriveChange, recipesFolderId: string, listedFileIds: ReadonlySet<string>): boolean {
  return listedFileIds.has(change.fileId) || (change.file?.parents?.includes(recipesFolderId) ?? false);
}

/** A Drive file whose content is read only when it is opened. */
export function driveDoc(file: DriveFile): Doc {
  return { key: file.fileId, id: file.id, recipe: emptyRecipe(), loaded: false, fileId: file.fileId, version: file.version, updatedAt: 0 };
}

export interface DriveMerge {
  /** The new list. */
  docs: Doc[];
  /** Gone from the folder (deleted, moved), without unsaved changes: dropped from the list. */
  removed: Doc[];
  /** Gone from the folder, with unsaved changes: kept as a new, unsaved recipe. */
  orphaned: Doc[];
  /** Read and unchanged here (open or not), but changed in Drive: read again. */
  reload: string[];
}

export function mergeDriveList(docs: Doc[], files: DriveFile[]): DriveMerge {
  const remaining = new Map(files.map((f) => [f.fileId, f]));
  const result: DriveMerge = { docs: [], removed: [], orphaned: [], reload: [] };
  for (const doc of docs) {
    if (!doc.fileId) {
      result.docs.push(doc); // not saved yet
      continue;
    }
    const file = remaining.get(doc.fileId);
    remaining.delete(doc.fileId);
    if (!file) {
      if (hasPendingChanges(doc)) {
        const kept: Doc = {
          ...doc,
          fileId: undefined,
          version: undefined,
          notice: `${doc.id}.json was deleted or moved in Google Drive. Save to keep this recipe there.`,
        };
        result.docs.push(kept);
        result.orphaned.push(kept);
      } else {
        result.removed.push(doc);
      }
    } else if (file.version === doc.version) {
      result.docs.push(doc);
    } else if (!doc.loaded) {
      result.docs.push({ ...doc, id: file.id, version: file.version });
    } else if (hasPendingChanges(doc)) {
      result.docs.push(doc); // the version check on save offers overwrite, copy or discard
    } else {
      result.docs.push({ ...doc, id: file.id });
      result.reload.push(doc.key);
    }
  }
  result.docs.push(...[...remaining.values()].map(driveDoc));
  return result;
}
