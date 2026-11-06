import { describe, expect, it } from "vitest";
import { fingerprint, newDoc, type Doc } from "../src/doc";
import { driveDoc, mergeDriveList } from "../src/driveSync";
import type { DriveFile } from "../src/store/DriveStore";

const recipe = { version: 2, name: "R", mashing_process: { goals: [{ type: "MashIn" }] } };

function file(fileId: string, id: string, version: string): DriveFile {
  return { fileId, id, version, modifiedTime: "" };
}

/** An opened Drive recipe, saved (no pending changes) unless changed. */
function opened(f: DriveFile, changed = false): Doc {
  const doc: Doc = { ...driveDoc(f), recipe, loaded: true };
  doc.baseline = fingerprint(doc);
  return changed ? { ...doc, recipe: { ...recipe, name: "edited here" } } : doc;
}

describe("mergeDriveList", () => {
  it("ACC-041 adds files that are new in Drive", () => {
    const merge = mergeDriveList([], [file("a", "A", "1"), file("b", "B", "1")]);
    expect(merge.docs.map((d) => [d.key, d.id, d.loaded])).toEqual([
      ["a", "A", false],
      ["b", "B", false],
    ]);
  });

  it("ACC-041 keeps unchanged recipes as they are", () => {
    const doc = opened(file("a", "A", "1"));
    const merge = mergeDriveList([doc], [file("a", "A", "1")]);
    expect(merge.docs).toEqual([doc]);
    expect(merge.reload).toEqual([]);
  });

  it("ACC-041 drops recipes deleted in Drive, but keeps unsaved changes as a new recipe", () => {
    const gone = opened(file("a", "A", "1"));
    const goneUnopened = driveDoc(file("b", "B", "1"));
    const edited = opened(file("c", "C", "1"), true);
    const merge = mergeDriveList([gone, goneUnopened, edited], []);
    expect(merge.removed).toEqual([gone, goneUnopened]);
    expect(merge.orphaned).toHaveLength(1);
    expect(merge.docs).toEqual(merge.orphaned);
    expect(merge.docs[0]).toMatchObject({ key: "c", id: "C", fileId: undefined, version: undefined });
    expect(merge.docs[0].notice).toContain("deleted or moved in Google Drive");
  });

  it("ACC-041 follows renames and changes: unopened ones at once, opened ones are read again", () => {
    const unopened = driveDoc(file("a", "A", "1"));
    const open = opened(file("b", "B", "1"));
    const merge = mergeDriveList([unopened, open], [file("a", "A2", "2"), file("b", "B2", "5")]);
    expect(merge.docs.map((d) => [d.key, d.id, d.version])).toEqual([
      ["a", "A2", "2"],
      ["b", "B2", "1"],
    ]);
    expect(merge.reload).toEqual(["b"]);
  });

  it("ACC-041 leaves recipes with unsaved changes alone when they changed in Drive (the save check decides)", () => {
    const edited = opened(file("a", "A", "1"), true);
    const merge = mergeDriveList([edited], [file("a", "A", "2")]);
    expect(merge.docs).toEqual([edited]);
    expect(merge.reload).toEqual([]);
  });

  it("ACC-041 keeps recipes not saved to Drive yet", () => {
    const draft = newDoc("New", recipe);
    expect(mergeDriveList([draft], []).docs).toEqual([draft]);
  });
});
