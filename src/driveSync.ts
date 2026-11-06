/**
 * Keeps the recipe list of a signed-in user in step with Google Drive: the list is read after sign-in and then
 * again regularly (App), because the same folder can change elsewhere: the editor in another tab or on another
 * device, or drive.google.com (rename, delete). Changes the user has not saved are never thrown away.
 */

import { hasPendingChanges, type Doc } from "./doc";
import { emptyRecipe } from "./model";
import type { DriveFile } from "./store/DriveStore";

/** How often the list is read again while the page is visible. */
export const SYNC_INTERVAL_MS = 30_000;

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
  /** Open and unchanged here, but changed in Drive: read again. */
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
