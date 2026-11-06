import { describe, expect, it } from "vitest";
import type { TokenSource } from "../src/auth/google";
import { DriveStore, NameTakenError, VersionConflictError } from "../src/store/DriveStore";

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties?: Record<string, string>;
  version: number;
  content: string;
  trashed: boolean;
}

/** A small in-memory Google Drive that answers the requests DriveStore sends. */
class FakeDrive {
  files: FakeFile[] = [];
  requests: string[] = [];
  /** Tokens the fake accepts. */
  validTokens = new Set(["t1"]);
  private next = 1;

  add(file: Partial<FakeFile> & { name: string }): FakeFile {
    const full: FakeFile = { id: `f${this.next++}`, mimeType: "application/json", parents: [], version: 1, content: "", trashed: false, ...file };
    this.files.push(full);
    return full;
  }

  private meta(f: FakeFile) {
    return { id: f.id, name: f.name, version: String(f.version), modifiedTime: "2026-11-06T10:00:00Z", parents: f.parents };
  }

  private matches(f: FakeFile, q: string): boolean {
    if (q.includes("trashed = false") && f.trashed) return false;
    if (q.includes("mimeType = 'application/vnd.google-apps.folder'") && f.mimeType !== "application/vnd.google-apps.folder") return false;
    if (q.includes("mimeType != 'application/vnd.google-apps.folder'") && f.mimeType === "application/vnd.google-apps.folder") return false;
    const role = /value='(\w+)'/.exec(q)?.[1];
    if (role && f.appProperties?.brewberrypi !== role) return false;
    const parent = /'([^']+)' in parents/.exec(q)?.[1];
    if (parent && !f.parents.includes(parent)) return false;
    return true;
  }

  private parseMultipart(body: string): { metadata: Record<string, unknown>; content: string } {
    const parts = body.split(/--brewberrypi-[^\r]+\r\n/).filter((p) => p.includes("\r\n\r\n"));
    const [meta, content] = parts.map((p) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n(--brewberrypi-.*--)?$/, ""));
    return { metadata: JSON.parse(meta) as Record<string, unknown>, content };
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    this.requests.push(`${method} ${url.pathname}`);
    const auth = new Headers(init?.headers).get("Authorization") ?? "";
    if (!this.validTokens.has(auth.replace("Bearer ", ""))) {
      return new Response(JSON.stringify({ error: { message: "Invalid Credentials" } }), { status: 401 });
    }
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    const path = url.pathname;
    const fileMatch = /\/files\/([^/]+)(\/copy)?$/.exec(path);
    if (method === "GET" && path.endsWith("/about")) {
      return ok({ user: { displayName: "Brewer", emailAddress: "brewer@example.com" } });
    }
    if (method === "GET" && path.endsWith("/files")) {
      const q = url.searchParams.get("q") ?? "";
      return ok({ files: this.files.filter((f) => this.matches(f, q)).map((f) => this.meta(f)) });
    }
    if (method === "POST" && path === "/drive/v3/files") {
      const body = JSON.parse(String(init?.body)) as Partial<FakeFile>;
      return ok(this.meta(this.add({ ...body, name: String(body.name) })));
    }
    if (method === "POST" && path === "/upload/drive/v3/files") {
      const { metadata, content } = this.parseMultipart(String(init?.body));
      return ok(this.meta(this.add({ name: String(metadata.name), parents: metadata.parents as string[], content })));
    }
    const file = fileMatch ? this.files.find((f) => f.id === fileMatch[1]) : undefined;
    if (!file) {
      return new Response("{}", { status: 404 });
    }
    if (method === "POST" && fileMatch?.[2]) {
      const body = JSON.parse(String(init?.body)) as { name: string; parents: string[] };
      return ok(this.meta(this.add({ name: body.name, parents: body.parents, content: file.content })));
    }
    if (method === "GET") {
      return url.searchParams.get("alt") === "media" ? new Response(file.content, { status: 200 }) : ok(this.meta(file));
    }
    if (method === "PATCH" && path.startsWith("/upload/")) {
      const { metadata, content } = this.parseMultipart(String(init?.body));
      Object.assign(file, { name: metadata.name ?? file.name, content, version: file.version + 1 });
      return ok(this.meta(file));
    }
    if (method === "PATCH") {
      Object.assign(file, JSON.parse(String(init?.body)), { version: file.version + 1 });
      return ok(this.meta(file));
    }
    return new Response("{}", { status: 400 });
  };
}

class FakeAuth implements TokenSource {
  current = "t1";
  renewals = 0;
  async token() {
    return this.current;
  }
  async renew() {
    this.renewals++;
    this.current = "t2";
    return this.current;
  }
}

async function setup() {
  const drive = new FakeDrive();
  const auth = new FakeAuth();
  const store = new DriveStore(auth, drive.fetch);
  await store.init();
  return { drive, auth, store };
}

const recipe = { version: 1, name: "R", mashing_process: { goals: [{ type: "MashIn" }] } };

describe("DriveStore", () => {
  it("creates BrewberryPi/recipes once and finds it again", async () => {
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

  it("saves, lists and reads recipe files", async () => {
    const { drive, store } = await setup();
    const created = await store.create("Weizen", recipe);
    expect(created.id).toBe("Weizen");
    drive.add({ name: "notes.txt", parents: [store.recipesFolderId] });
    expect((await store.list()).map((f) => f.id)).toEqual(["Weizen"]);
    const { file, text } = await store.read(created.fileId);
    expect(file.version).toBe("1");
    expect(JSON.parse(text)).toEqual(recipe);
  });

  it("refuses a second file with the same name", async () => {
    const { store } = await setup();
    await store.create("A", recipe);
    await expect(store.create("A", recipe)).rejects.toBeInstanceOf(NameTakenError);
  });

  it("refuses to overwrite a file changed since it was loaded", async () => {
    const { drive, store } = await setup();
    const created = await store.create("A", recipe);
    drive.files.find((f) => f.id === created.fileId)!.version = 5;
    await expect(store.update(created.fileId, "A", recipe, created.version)).rejects.toBeInstanceOf(VersionConflictError);
    const saved = await store.update(created.fileId, "A", { ...recipe, name: "forced" }, created.version, true);
    expect(saved.version).toBe("6");
  });

  it("renames on save, but not onto another file", async () => {
    const { store } = await setup();
    const a = await store.create("A", recipe);
    await store.create("B", recipe);
    const renamed = await store.update(a.fileId, "C", recipe, a.version);
    expect(renamed.id).toBe("C");
    await expect(store.update(a.fileId, "B", recipe, renamed.version)).rejects.toBeInstanceOf(NameTakenError);
  });

  it("moves deleted recipes to the trash", async () => {
    const { drive, store } = await setup();
    const a = await store.create("A", recipe);
    await store.trash(a.fileId);
    expect(drive.files.find((f) => f.id === a.fileId)?.trashed).toBe(true);
    expect(await store.list()).toEqual([]);
  });

  it("adopts picked files: in the folder as they are, from elsewhere as a copy", async () => {
    const { drive, store } = await setup();
    await store.create("X", recipe);
    const inFolder = drive.add({ name: "Mine.json", parents: [store.recipesFolderId], content: "{}" });
    const elsewhere = drive.add({ name: "X.json", parents: ["other"], content: "{}" });
    const adopted = await store.adopt([inFolder.id, elsewhere.id]);
    expect(adopted.map((f) => f.id)).toEqual(["Mine", "X-2"]);
    expect(adopted[0].fileId).toBe(inFolder.id);
    expect(adopted[1].fileId).not.toBe(elsewhere.id);
  });

  it("renews the token once on 401", async () => {
    const { drive, auth, store } = await setup();
    drive.validTokens = new Set(["t2"]);
    expect(await store.about()).toEqual({ name: "Brewer", email: "brewer@example.com" });
    expect(auth.renewals).toBe(1);
  });

  it("reports Drive errors", async () => {
    const { store } = await setup();
    await expect(store.read("missing")).rejects.toThrow("Google Drive answered 404.");
  });
});
