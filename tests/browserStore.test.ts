import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { newDoc } from "../src/doc";
import { openDraftStore } from "../src/store/BrowserStore";

const recipe = { version: 2, name: "R", mashing_process: { goals: [{ type: "MashIn" }] } };

function storage(persist: boolean): StorageManager {
  return { persisted: async () => false, persist: async () => persist } as unknown as StorageManager;
}

describe("draft store", () => {
  it("keeps drafts across a re-open (a reload)", async () => {
    const factory = new IDBFactory();
    const first = await openDraftStore(factory, storage(true));
    expect(first.kind).toBe("persistent");
    const doc = newDoc("A", recipe);
    await first.put(doc);
    const second = await openDraftStore(factory, storage(true));
    expect(await second.all()).toEqual([doc]);
    await second.delete(doc.key);
    expect(await second.all()).toEqual([]);
  });

  it("says when the browser may clear the drafts", async () => {
    expect((await openDraftStore(new IDBFactory(), storage(false))).kind).toBe("best-effort");
    expect((await openDraftStore(new IDBFactory(), undefined)).kind).toBe("best-effort");
  });

  it("falls back to memory without IndexedDB", async () => {
    const store = await openDraftStore(undefined, undefined);
    expect(store.kind).toBe("memory");
    await store.put(newDoc("A", recipe));
    expect(await store.all()).toHaveLength(1);
    await store.clear();
    expect(await store.all()).toHaveLength(0);
  });

  it("falls back to memory when IndexedDB fails to open", async () => {
    const broken = { open: () => { throw new Error("denied"); } } as unknown as IDBFactory;
    expect((await openDraftStore(broken, storage(true))).kind).toBe("memory");
  });
});
