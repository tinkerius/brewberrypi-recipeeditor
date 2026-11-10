import { describe, expect, it } from "vitest";
import { DriveStore, NameTakenError, VersionConflictError } from "../src/store/DriveStore";
import { isRelevantChange } from "../src/driveSync";
import { FakeAuth, FakeDrive } from "./fakeDrive";

async function setup() {
  const drive = new FakeDrive();
  const auth = new FakeAuth();
  const store = new DriveStore(auth, drive.fetch);
  await store.init();
  return { drive, auth, store };
}

const recipe = { version: 3, name: "R", mashing_process: { goals: [{ type: "MashIn" }] } };

describe("DriveStore", () => {
  it("ACC-018 says when the folders were created just now (the first sign-in)", async () => {
    const drive = new FakeDrive();
    expect(await new DriveStore(new FakeAuth(), drive.fetch).init()).toEqual({ created: true });
    expect(await new DriveStore(new FakeAuth(), drive.fetch).init()).toEqual({ created: false });
  });

  it("ACC-030 creates BrewberryPi/recipes once and finds it again", async () => {
    const { drive, store } = await setup();
    const folders = drive.files.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
    expect(folders.map((f) => [f.name, f.appProperties?.brewberrypi])).toEqual([
      ["BrewberryPi", "root"],
      ["recipes", "recipes"],
    ]);
    expect(folders[1].parents).toEqual([folders[0].id]);
    const again = new DriveStore(new FakeAuth(), drive.fetch);
    await again.init();
    expect(drive.files.filter((f) => f.mimeType === "application/vnd.google-apps.folder")).toHaveLength(2);
    expect(again.recipesFolderId).toBe(store.recipesFolderId);
  });

  it("ACC-031 saves, lists and reads recipe files", async () => {
    const { drive, store } = await setup();
    const created = await store.create("Weizen", recipe);
    expect(created.id).toBe("Weizen");
    drive.add({ name: "notes.txt", parents: [store.recipesFolderId] });
    expect((await store.list()).map((f) => f.id)).toEqual(["Weizen"]);
    const { file, text } = await store.read(created.fileId);
    expect(file.version).toBe("1");
    expect(JSON.parse(text)).toEqual(recipe);
  });

  it("ACC-032 refuses a second file with the same name", async () => {
    const { store } = await setup();
    await store.create("A", recipe);
    await expect(store.create("A", recipe)).rejects.toBeInstanceOf(NameTakenError);
  });

  it("ACC-033 refuses to overwrite a file changed since it was loaded", async () => {
    const { drive, store } = await setup();
    const created = await store.create("A", recipe);
    drive.files.find((f) => f.id === created.fileId)!.version = 5;
    await expect(store.update(created.fileId, "A", recipe, created.version)).rejects.toBeInstanceOf(VersionConflictError);
    const saved = await store.update(created.fileId, "A", { ...recipe, name: "forced" }, created.version, true);
    expect(saved.version).toBe("6");
  });

  it("ACC-032 renames on save, but not onto another file", async () => {
    const { store } = await setup();
    const a = await store.create("A", recipe);
    await store.create("B", recipe);
    const renamed = await store.update(a.fileId, "C", recipe, a.version);
    expect(renamed.id).toBe("C");
    await expect(store.update(a.fileId, "B", recipe, renamed.version)).rejects.toBeInstanceOf(NameTakenError);
  });

  it("ACC-012 renames a file without changing its content, and says whether it was still current", async () => {
    const { drive, store } = await setup();
    const a = await store.create("A", recipe);
    await store.create("B", recipe);
    const renamed = await store.rename(a.fileId, "C", a.version);
    expect(renamed.file.id).toBe("C");
    expect(renamed.current).toBe(true);
    expect(JSON.parse(drive.files.find((f) => f.id === a.fileId)!.content)).toEqual(recipe);
    await expect(store.rename(a.fileId, "B", renamed.file.version)).rejects.toBeInstanceOf(NameTakenError);
    drive.files.find((f) => f.id === a.fileId)!.version += 3; // changed elsewhere
    expect((await store.rename(a.fileId, "D", renamed.file.version)).current).toBe(false);
  });

  it("ACC-014 moves deleted recipes to the trash", async () => {
    const { drive, store } = await setup();
    const a = await store.create("A", recipe);
    await store.trash(a.fileId);
    expect(drive.files.find((f) => f.id === a.fileId)?.trashed).toBe(true);
    expect(await store.list()).toEqual([]);
  });

  it("ACC-034 adopts picked files: in the folder as they are, from elsewhere as a copy", async () => {
    const { drive, store } = await setup();
    await store.create("X", recipe);
    const inFolder = drive.add({ name: "Mine.json", parents: [store.recipesFolderId], content: "{}" });
    const elsewhere = drive.add({ name: "X.json", parents: ["other"], content: "{}" });
    const adopted = await store.adopt([inFolder.id, elsewhere.id]);
    expect(adopted.map((f) => f.id)).toEqual(["Mine", "X-2"]);
    expect(adopted[0].fileId).toBe(inFolder.id);
    expect(adopted[1].fileId).not.toBe(elsewhere.id);
  });

  it("ACC-035 renews the token once on 401", async () => {
    const { drive, auth, store } = await setup();
    drive.validTokens = new Set(["t2"]);
    expect(await store.about()).toEqual({ name: "Brewer", email: "brewer@example.com" });
    expect(auth.renewals).toBe(1);
  });

  it("ACC-035 reports Drive errors", async () => {
    const { store } = await setup();
    await expect(store.read("missing")).rejects.toThrow("Google Drive answered 404.");
  });
});

describe("DriveStore changes feed", () => {
  it("ACC-040 reports changes in the recipes folder since the last call, across pages", async () => {
    const { drive, store } = await setup();
    await store.startChanges();
    expect(await store.changedSince(new Set())).toBe(false);
    drive.add({ name: "Other.json", parents: ["elsewhere"] });
    drive.add({ name: "Elsewhere2.json", parents: ["elsewhere"] });
    expect(await store.changedSince(new Set())).toBe(false); // not in the folder
    drive.add({ name: "Other3.json", parents: ["elsewhere"] });
    drive.add({ name: "Other4.json", parents: ["elsewhere"] });
    drive.add({ name: "New.json", parents: [store.recipesFolderId] }); // on the third page
    expect(await store.changedSince(new Set())).toBe(true);
    expect(await store.changedSince(new Set())).toBe(false); // seen
  });

  it("ACC-040 reports edits, renames and trashing of listed recipes", async () => {
    const { drive, store } = await setup();
    const created = await store.create("A", recipe);
    await store.startChanges();
    const listed = new Set([created.fileId]);
    const file = drive.files.find((f) => f.id === created.fileId)!;
    Object.assign(file, { trashed: true });
    drive.changed(file);
    expect(await store.changedSince(listed)).toBe(true);
  });

  it("ACC-040 starts again after an invalid position, and counts that as a change", async () => {
    const { drive, store } = await setup();
    await store.startChanges();
    drive.changeLog.length = 0; // the position is now ahead of the feed: Drive refuses it
    expect(await store.changedSince(new Set())).toBe(true);
    expect(await store.changedSince(new Set())).toBe(false);
  });

  it("ACC-040 without a start position, starts and counts it as a change", async () => {
    const { store } = await setup();
    expect(await store.changedSince(new Set())).toBe(true);
  });
});

describe("isRelevantChange", () => {
  const listed = new Set(["listed"]);
  it.each([
    ["a listed recipe changed", { fileId: "listed", file: { parents: ["folder"] } }, true],
    ["a listed recipe removed", { fileId: "listed", removed: true }, true],
    ["a listed recipe moved away", { fileId: "listed", file: { parents: ["other"] } }, true],
    ["a new file in the folder", { fileId: "new", file: { parents: ["folder"] } }, true],
    ["a file elsewhere", { fileId: "x", file: { parents: ["other"] } }, false],
    ["an unknown removed file", { fileId: "x", removed: true }, false],
  ])("ACC-040 %s", (_label, change, expected) => {
    expect(isRelevantChange(change, "folder", listed)).toBe(expected);
  });
});
