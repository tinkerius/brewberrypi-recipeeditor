/**
 * Drafts of signed-out users, kept in this browser (IndexedDB). This storage is not safe: clearing site data, a
 * private window, Safari's 7-day limit for sites not visited, or another browser or device loses it. The page says
 * so (StorageBanner). Without IndexedDB the drafts are only kept in memory, for this tab.
 */

import type { Doc } from "../doc";

export type BrowserStorageKind = "persistent" | "best-effort" | "memory";

export interface DraftStore {
  readonly kind: BrowserStorageKind;
  all(): Promise<Doc[]>;
  put(doc: Doc): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = "brewberrypi-recipeeditor";
const STORE = "drafts";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB not available"));
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

class IndexedDbStore implements DraftStore {
  constructor(
    private readonly db: IDBDatabase,
    readonly kind: BrowserStorageKind,
  ) {}

  private store(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }

  all(): Promise<Doc[]> {
    return request(this.store("readonly").getAll() as IDBRequest<Doc[]>);
  }

  async put(doc: Doc): Promise<void> {
    await request(this.store("readwrite").put(doc));
  }

  async delete(key: string): Promise<void> {
    await request(this.store("readwrite").delete(key));
  }

  async clear(): Promise<void> {
    await request(this.store("readwrite").clear());
  }
}

export class MemoryStore implements DraftStore {
  readonly kind = "memory";
  private readonly docs = new Map<string, Doc>();

  async all(): Promise<Doc[]> {
    return [...this.docs.values()].map((d) => structuredClone(d));
  }

  async put(doc: Doc): Promise<void> {
    this.docs.set(doc.key, structuredClone(doc));
  }

  async delete(key: string): Promise<void> {
    this.docs.delete(key);
  }

  async clear(): Promise<void> {
    this.docs.clear();
  }
}

/** Asks the browser to keep the drafts when space runs low (Chrome, Firefox); false where it says no. */
async function requestPersistence(storage: StorageManager | undefined): Promise<boolean> {
  try {
    if (!storage?.persist) {
      return false;
    }
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}

/** Opens the draft store: IndexedDB if the browser allows it, else memory. */
export async function openDraftStore(
  factory: IDBFactory | undefined = globalThis.indexedDB,
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<DraftStore> {
  if (!factory) {
    return new MemoryStore();
  }
  try {
    const db = await openDatabase(factory);
    const persistent = await requestPersistence(storage);
    return new IndexedDbStore(db, persistent ? "persistent" : "best-effort");
  } catch {
    // Firefox private windows (older versions), disabled storage, ...
    return new MemoryStore();
  }
}
