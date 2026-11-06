/**
 * Recipes of signed-in users in their Google Drive: folder "BrewberryPi" (room for more later), in it "recipes",
 * one "<id>.json" per recipe, the format the BrewberryPi app reads from its recipe folder. Drive v3 REST via fetch.
 *
 * Scope drive.file: the editor sees only the files and folders it created, or that the user picked with the Google
 * Picker (picker.ts). The folders carry appProperties so they are found again even if the user renames them.
 */

import { idFromFileName, serializeRecipe, type Recipe } from "../model";
import type { TokenSource } from "../auth/google";

export const ROOT_FOLDER_NAME = "BrewberryPi";
export const RECIPES_FOLDER_NAME = "recipes";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FILE_FIELDS = "id,name,version,modifiedTime,parents";

export interface DriveFile {
  fileId: string;
  /** Recipe id: the file name without ".json". */
  id: string;
  version: string;
  modifiedTime: string;
}

interface ApiFile {
  id: string;
  name: string;
  version?: string;
  modifiedTime?: string;
  parents?: string[];
}

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Another file in the recipes folder already has this name. */
export class NameTakenError extends Error {
  constructor(readonly id: string) {
    super(`A recipe file "${id}.json" already exists in your Drive.`);
  }
}

/** The file changed in Drive since it was loaded (another tab, device or person). */
export class VersionConflictError extends Error {
  constructor(readonly file: DriveFile) {
    super("This recipe was changed in Google Drive since you opened it.");
  }
}

function toDriveFile(file: ApiFile): DriveFile {
  return { fileId: file.id, id: idFromFileName(file.name), version: file.version ?? "", modifiedTime: file.modifiedTime ?? "" };
}

function multipart(metadata: object, content: string): { body: string; contentType: string } {
  const boundary = `brewberrypi-${crypto.randomUUID()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

export class DriveStore {
  private rootId: string | undefined;
  private recipesId: string | undefined;

  constructor(
    private readonly auth: TokenSource,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** The recipes folder's id (after init()). */
  get recipesFolderId(): string {
    if (!this.recipesId) {
      throw new Error("DriveStore not initialised");
    }
    return this.recipesId;
  }

  private async call(method: string, url: string, init: { body?: string; contentType?: string } = {}): Promise<Response> {
    const send = async (token: string) =>
      this.fetchFn(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(init.contentType ? { "Content-Type": init.contentType } : {}) },
        body: init.body,
      });
    let response = await send(await this.auth.token());
    if (response.status === 401) {
      response = await send(await this.auth.renew());
    }
    if (!response.ok) {
      let message = `Google Drive answered ${response.status}.`;
      try {
        const error = (await response.json()) as { error?: { message?: string } };
        if (error.error?.message) {
          message = `Google Drive: ${error.error.message}`;
        }
      } catch {
        // not JSON
      }
      throw new DriveError(response.status, message);
    }
    return response;
  }

  private async json<T>(method: string, url: string, init?: { body?: string; contentType?: string }): Promise<T> {
    return (await (await this.call(method, url, init)).json()) as T;
  }

  private async findFolder(role: "root" | "recipes", parent?: string): Promise<string | undefined> {
    const q = [
      `mimeType = '${FOLDER_MIME}'`,
      "trashed = false",
      `appProperties has { key='brewberrypi' and value='${role}' }`,
      ...(parent ? [`'${parent}' in parents`] : []),
    ].join(" and ");
    const params = new URLSearchParams({ q, fields: "files(id)", orderBy: "createdTime", pageSize: "10", spaces: "drive" });
    const found = await this.json<{ files: { id: string }[] }>("GET", `${API}/files?${params}`);
    return found.files[0]?.id;
  }

  private async createFolder(name: string, role: "root" | "recipes", parent?: string): Promise<string> {
    const metadata = { name, mimeType: FOLDER_MIME, appProperties: { brewberrypi: role }, ...(parent ? { parents: [parent] } : {}) };
    const created = await this.json<{ id: string }>("POST", `${API}/files?fields=id`, {
      body: JSON.stringify(metadata),
      contentType: "application/json",
    });
    return created.id;
  }

  /** Finds the folders BrewberryPi/recipes, or creates them. */
  async init(): Promise<void> {
    this.rootId = (await this.findFolder("root")) ?? (await this.createFolder(ROOT_FOLDER_NAME, "root"));
    this.recipesId =
      (await this.findFolder("recipes", this.rootId)) ?? (await this.createFolder(RECIPES_FOLDER_NAME, "recipes", this.rootId));
  }

  /** The recipe files (*.json) in the recipes folder that this editor can see. */
  async list(): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `'${this.recipesFolderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: "1000",
        spaces: "drive",
        ...(pageToken ? { pageToken } : {}),
      });
      const page = await this.json<{ files: ApiFile[]; nextPageToken?: string }>("GET", `${API}/files?${params}`);
      files.push(...page.files.filter((f) => f.name.toLowerCase().endsWith(".json")).map(toDriveFile));
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  private async metadata(fileId: string): Promise<ApiFile> {
    return this.json<ApiFile>("GET", `${API}/files/${encodeURIComponent(fileId)}?fields=${FILE_FIELDS}`);
  }

  /** The file's content as text, and its current version. */
  async read(fileId: string): Promise<{ file: DriveFile; text: string }> {
    const meta = await this.metadata(fileId);
    const text = await (await this.call("GET", `${API}/files/${encodeURIComponent(fileId)}?alt=media`)).text();
    return { file: toDriveFile(meta), text };
  }

  private async assertNameFree(id: string, except?: string) {
    const taken = (await this.list()).some((f) => f.id === id && f.fileId !== except);
    if (taken) {
      throw new NameTakenError(id);
    }
  }

  /** Saves a new recipe file. */
  async create(id: string, recipe: Recipe): Promise<DriveFile> {
    await this.assertNameFree(id);
    const { body, contentType } = multipart(
      { name: `${id}.json`, mimeType: "application/json", parents: [this.recipesFolderId] },
      serializeRecipe(recipe),
    );
    return toDriveFile(await this.json<ApiFile>("POST", `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`, { body, contentType }));
  }

  /**
   * Saves a changed recipe (and its new file name). Refuses with VersionConflictError when the file changed in Drive
   * since it was loaded at expectedVersion; force overwrites anyway.
   */
  async update(fileId: string, id: string, recipe: Recipe, expectedVersion: string | undefined, force = false): Promise<DriveFile> {
    const current = toDriveFile(await this.metadata(fileId));
    if (!force && expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new VersionConflictError(current);
    }
    if (current.id !== id) {
      await this.assertNameFree(id, fileId);
    }
    const { body, contentType } = multipart({ name: `${id}.json` }, serializeRecipe(recipe));
    return toDriveFile(
      await this.json<ApiFile>("PATCH", `${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=${FILE_FIELDS}`, {
        body,
        contentType,
      }),
    );
  }

  /** Moves the file to the Drive trash (recoverable there for 30 days). */
  async trash(fileId: string): Promise<void> {
    await this.call("PATCH", `${API}/files/${encodeURIComponent(fileId)}?fields=id`, {
      body: JSON.stringify({ trashed: true }),
      contentType: "application/json",
    });
  }

  /**
   * Takes files the user picked in the Google Picker into the recipes folder: files already in it just become
   * visible to the editor (drive.file); files from elsewhere are copied in, under a free name.
   */
  async adopt(fileIds: string[]): Promise<DriveFile[]> {
    const adopted: DriveFile[] = [];
    let taken = new Set((await this.list()).map((f) => f.id));
    for (const fileId of fileIds) {
      const meta = await this.metadata(fileId);
      if (meta.parents?.includes(this.recipesFolderId)) {
        adopted.push(toDriveFile(meta));
        continue;
      }
      let id = idFromFileName(meta.name);
      for (let n = 2; taken.has(id); n++) {
        id = `${idFromFileName(meta.name)}-${n}`;
      }
      const copy = await this.json<ApiFile>("POST", `${API}/files/${encodeURIComponent(fileId)}/copy?fields=${FILE_FIELDS}`, {
        body: JSON.stringify({ name: `${id}.json`, parents: [this.recipesFolderId] }),
        contentType: "application/json",
      });
      taken = new Set([...taken, id]);
      adopted.push(toDriveFile(copy));
    }
    return adopted;
  }

  /** The signed-in user's name and e-mail address. */
  async about(): Promise<{ name: string; email: string }> {
    const about = await this.json<{ user?: { displayName?: string; emailAddress?: string } }>(
      "GET",
      `${API}/about?fields=user(displayName,emailAddress)`,
    );
    return { name: about.user?.displayName ?? "", email: about.user?.emailAddress ?? "" };
  }
}
