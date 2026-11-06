/** An in-memory Google Drive and token source for the tests (no network). */

import type { TokenSource } from "../src/auth/google";

export interface FakeFile {
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
export class FakeDrive {
  files: FakeFile[] = [];
  requests: string[] = [];
  /** Tokens the fake accepts. */
  validTokens = new Set(["t1"]);
  private next = 1;
  /** The changes feed: one entry per change, a page token is an index into it. */
  changeLog: { fileId: string; file: { parents: string[]; trashed: boolean } }[] = [];
  /** Page size of the changes feed, small to test paging. */
  changePageSize = 2;

  add(file: Partial<FakeFile> & { name: string }): FakeFile {
    const full: FakeFile = { id: `f${this.next++}`, mimeType: "application/json", parents: [], version: 1, content: "", trashed: false, ...file };
    this.files.push(full);
    this.changed(full);
    return full;
  }

  changed(file: FakeFile) {
    this.changeLog.push({ fileId: file.id, file: { parents: [...file.parents], trashed: file.trashed } });
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
    if (method === "GET" && path.endsWith("/changes/startPageToken")) {
      return ok({ startPageToken: String(this.changeLog.length) });
    }
    if (method === "GET" && path.endsWith("/changes")) {
      const from = Number(url.searchParams.get("pageToken"));
      if (!Number.isInteger(from) || from > this.changeLog.length) {
        return new Response(JSON.stringify({ error: { message: "Invalid page token" } }), { status: 400 });
      }
      const to = Math.min(from + this.changePageSize, this.changeLog.length);
      const changes = this.changeLog.slice(from, to);
      return ok(to < this.changeLog.length ? { changes, nextPageToken: String(to) } : { changes, newStartPageToken: String(to) });
    }
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
      this.changed(file);
      return ok(this.meta(file));
    }
    if (method === "PATCH") {
      Object.assign(file, JSON.parse(String(init?.body)), { version: file.version + 1 });
      this.changed(file);
      return ok(this.meta(file));
    }
    return new Response("{}", { status: 400 });
  };
}

export class FakeAuth implements TokenSource {
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
