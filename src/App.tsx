/**
 * The recipe editor. Signed out, recipes are drafts in this browser (BrowserStore) that the user downloads one by
 * one; signed in with Google, they are files in the user's Google Drive, BrewberryPi/recipes (DriveStore).
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { GoogleAuth, SignInError, TOKEN_KEY, rememberHint } from "./auth/google";
import { googleConfigured, pickerConfigured } from "./config";
import { fingerprint, freeId, hasPendingChanges, newDoc, problemsOf, type Doc } from "./doc";
import { pickRecipeFiles } from "./drive/picker";
import { CHANGE_POLL_MS, FULL_SYNC_MS, driveDoc, mergeDriveList } from "./driveSync";
import { downloadRecipe, readRecipeFile } from "./file";
import { emptyRecipe, readRecipe, type Recipe } from "./model";
import { firstSample } from "./samples";
import { openDraftStore, type DraftStore } from "./store/BrowserStore";
import { DriveError, DriveStore, NameTakenError, VersionConflictError, type DriveFile } from "./store/DriveStore";
import { ErrorBanner, InfoBanner, StorageBanner } from "./ui/Banners";
import { GoogleSignInButton } from "./ui/GoogleButton";
import { MigrateDialog, type MigrateChoice } from "./ui/MigrateDialog";
import { Modal } from "./ui/Modal";
import { RecipeEditor } from "./ui/RecipeEditor";
import { NameDialog } from "./ui/NameDialog";
import { RecipeList, type RecipeAction } from "./ui/RecipeList";
import { BUTTON_STYLES, CARD_STYLE, HINT_STYLE, LINK_STYLE, TITLE_STYLE } from "./ui/styles";

export const APP_TITLE = "Recipe Editor";

/** What the file-name dialog is for: the name is asked when a recipe is created, duplicated or renamed. */
type NameRequest =
  | { kind: "new" }
  | { kind: "duplicate"; key: string }
  | { kind: "rename"; key: string };
const SAVE_DELAY_MS = 200;

type Place =
  | { kind: "browser" }
  | { kind: "drive"; store: DriveStore; account: { name: string; email: string } };

interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sortDocs(docs: Doc[]): Doc[] {
  return [...docs].sort((a, b) => {
    const ka = (a.id || "￿").toLowerCase();
    const kb = (b.id || "￿").toLowerCase();
    return ka < kb ? -1 : ka > kb ? 1 : b.updatedAt - a.updatedAt;
  });
}

export function App(props: { openDrafts?: () => Promise<DraftStore>; auth?: GoogleAuth }) {
  const [drafts, setDrafts] = useState<DraftStore>();
  const [place, setPlace] = useState<Place>({ kind: "browser" });
  const [docs, setDocsState] = useState<Doc[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [storageFailed, setStorageFailed] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [conflict, setConflict] = useState<{ doc: Doc; file: DriveFile }>();
  const [migration, setMigration] = useState<{ drafts: Doc[]; driveIds: Set<string> }>();
  const [nameRequest, setNameRequest] = useState<NameRequest>();
  const [dragging, setDragging] = useState(false);
  const auth = useRef(props.auth ?? new GoogleAuth());
  const uploadInput = useRef<HTMLInputElement>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Async handlers read the latest state through refs.
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const placeRef = useRef(place);
  placeRef.current = place;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const selectedRef = useRef(selectedKey);
  selectedRef.current = selectedKey;

  const setDocs = (next: Doc[]) => {
    docsRef.current = next;
    setDocsState(next);
  };

  /** Keeps a browser draft (debounced while typing). */
  const storeDraft = (doc: Doc) => {
    if (placeRef.current.kind !== "browser" || !drafts) {
      return;
    }
    clearTimeout(saveTimers.current.get(doc.key));
    saveTimers.current.set(
      doc.key,
      setTimeout(() => {
        saveTimers.current.delete(doc.key);
        drafts.put(doc).catch((e: unknown) => {
          setStorageFailed(true);
          setError(`This browser refused to store the recipe: ${message(e)}. Download it to keep it.`);
        });
      }, SAVE_DELAY_MS),
    );
  };

  const putDoc = (doc: Doc, select = false) => {
    const others = docsRef.current.filter((d) => d.key !== doc.key);
    setDocs(sortDocs([...others, doc]));
    storeDraft(doc);
    if (select) {
      selectedRef.current = doc.key;
      setSelectedKey(doc.key);
    }
  };

  const replaceDoc = (oldKey: string, doc: Doc) => {
    setDocs(sortDocs([...docsRef.current.filter((d) => d.key !== oldKey && d.key !== doc.key), doc]));
    if (selectedRef.current === oldKey) {
      setSelectedKey(doc.key);
    }
  };

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(undefined);
    }
  };

  // Start: the drafts kept in this browser.
  useEffect(() => {
    void (async () => {
      const store = await (props.openDrafts ?? openDraftStore)();
      draftsRef.current = store;
      setDrafts(store);
      try {
        let kept = sortDocs(await store.all());
        const sample = firstSample();
        if (store.firstUse && kept.length === 0 && sample) {
          // EDT-016: a new workspace gets an example, once.
          const doc = newDoc(sample.id, sample.recipe);
          await store.put(doc);
          kept = [doc];
        }
        setDocs(kept);
        setSelectedKey(kept[0]?.key);
      } catch (e) {
        setError(`Could not read the recipes stored in this browser: ${message(e)}`);
      }
      // Still signed in from another tab or an earlier visit (the token lasts about an hour).
      if (googleConfigured() && auth.current.hasValidToken()) {
        await restoreDrive();
      }
    })();
  }, []);

  /** Signs in with the stored token, without Google's window; a token that no longer works is dropped quietly. */
  const restoreDrive = async () => {
    setBusy("Signing in with Google…");
    try {
      await enterDrive(false);
    } catch {
      auth.current.forget(true);
      if (placeRef.current.kind === "drive") {
        await leaveDrive();
      }
    } finally {
      setBusy(undefined);
    }
  };

  // Signed out in another tab: sign out here too (unsaved changes stay until this tab signs in again or leaves).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY || e.newValue !== null || placeRef.current.kind !== "drive") {
        return;
      }
      auth.current.forget();
      if (docsRef.current.some(hasPendingChanges)) {
        setInfo("You signed out in another tab. Sign in again to save your changes to Google Drive.");
      } else {
        setInfo("You signed out in another tab.");
        void leaveDrive();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Leaving the page with work that would be lost.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const pending = docsRef.current.some(hasPendingChanges);
      const atRisk =
        placeRef.current.kind === "drive" ? pending : pending && (drafts?.kind === "memory" || storageFailed);
      if (atRisk) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [drafts, storageFailed]);

  const takenIds = () => docsRef.current.map((d) => d.id);
  const selected = docs.find((d) => d.key === selectedKey);

  // ---- Recipes, both places ----

  const newRecipe = () => setNameRequest({ kind: "new" });


  const upload = async (files: FileList | File[]) => {
    const problems: string[] = [];
    let first: Doc | undefined;
    for (const file of Array.from(files)) {
      const read = await readRecipeFile(file);
      if (!read.recipe) {
        problems.push(`${read.fileName}: ${read.error}`);
        continue;
      }
      const doc: Doc = { ...newDoc(freeId(read.id, takenIds()), read.recipe), notice: read.converted };
      if (doc.id !== read.id) {
        problems.push(`${read.fileName}: a recipe with this file name is already open; added as ${doc.id}.json.`);
      }
      putDoc(doc);
      first ??= doc;
    }
    if (first) {
      selectDoc(first.key);
    }
    if (problems.length > 0) {
      setError(problems.join("\n"));
    }
  };

  const change = (doc: Doc, recipe: Recipe) => putDoc({ ...doc, recipe, updatedAt: Date.now() });

  const download = (doc: Doc) => {
    downloadRecipe(doc.id, doc.recipe);
    if (placeRef.current.kind === "browser") {
      putDoc({ ...doc, notice: undefined, baseline: fingerprint(doc) });
    }
  };

  /** The doc with its content (Drive recipes are read when first needed). */
  const ensureLoaded = async (key: string): Promise<Doc | undefined> => {
    if (docsRef.current.find((d) => d.key === key)?.loaded === false) {
      await loadDoc(key);
    }
    return docsRef.current.find((d) => d.key === key && d.loaded);
  };

  /** Renames a recipe's file: in Drive at once (content unchanged), else the next download uses the new name. */
  const rename = (doc: Doc, id: string) => {
    const current = placeRef.current;
    if (current.kind !== "drive" || !doc.fileId) {
      putDoc({ ...doc, id, updatedAt: Date.now() });
      return;
    }
    const fileId = doc.fileId;
    void run("Renaming…", async () => {
      try {
        const { file, current: wasCurrent } = await current.store.rename(fileId, id, doc.loaded ? doc.version : undefined);
        const now = docsRef.current.find((d) => d.key === doc.key) ?? doc;
        // The saved content stays the same under its new name.
        const baseline = now.baseline === undefined ? undefined : `${file.id}${now.baseline.slice(now.baseline.indexOf("\n"))}`;
        putDoc({ ...now, id: file.id, version: wasCurrent ? file.version : now.version, baseline, updatedAt: Date.now() });
      } catch (e) {
        if (e instanceof NameTakenError) {
          setError(`${e.message} Choose another file name.`);
          return;
        }
        throw e;
      }
    });
  };

  const onRecipeAction = (doc: Doc, action: RecipeAction) => {
    switch (action) {
      case "rename":
      case "duplicate":
        setNameRequest({ kind: action, key: doc.key });
        break;
      case "download":
        void (async () => {
          const loaded = await ensureLoaded(doc.key);
          if (!loaded) {
            return;
          }
          if (problemsOf(loaded).length > 0 || loaded.loadError) {
            selectDoc(loaded.key);
            setError(`${loaded.id}.json is incomplete; fix it before downloading.`);
            return;
          }
          download(loaded);
        })();
        break;
      case "delete":
        remove(doc);
        break;
    }
  };

  /** The file-name dialog for nameRequest, or nothing. */
  const nameDialog = (request: NameRequest) => {
    const doc = "key" in request ? docsRef.current.find((d) => d.key === request.key) : undefined;
    const others = new Set(docsRef.current.filter((d) => d !== doc || request.kind !== "rename").map((d) => d.id));
    const close = () => setNameRequest(undefined);
    const settings = {
      new: { title: "New recipe", initial: "", confirmLabel: "Create" },
      duplicate: { title: `Duplicate ${doc?.id ?? ""}.json`, initial: freeId(doc?.id || "recipe", others), confirmLabel: "Duplicate" },
      rename: { title: `Rename ${doc?.id ?? ""}.json`, initial: doc?.id ?? "", confirmLabel: "Rename" },
    }[request.kind];
    if ("key" in request && !doc) {
      return null; // gone meanwhile (deleted elsewhere)
    }
    return (
      <NameDialog
        {...settings}
        taken={others}
        onCancel={close}
        onConfirm={(id) => {
          close();
          if (request.kind === "new") {
            putDoc(newDoc(id, emptyRecipe()), true);
          } else if (request.kind === "duplicate" && doc) {
            void ensureLoaded(doc.key).then((source) => source && putDoc(newDoc(id, structuredClone(source.recipe)), true));
          } else if (request.kind === "rename" && doc) {
            rename(doc, id);
          }
        }}
      />
    );
  };

  const removeFromList = (doc: Doc) => {
    const rest = docsRef.current.filter((d) => d.key !== doc.key);
    setDocs(rest);
    if (selectedRef.current === doc.key) {
      setSelectedKey(rest[0]?.key);
      if (rest[0] && !rest[0].loaded) {
        void loadDoc(rest[0].key);
      }
    }
  };

  const remove = (doc: Doc) => {
    const current = placeRef.current;
    setConfirmation({
      title: "Delete recipe",
      message:
        current.kind === "drive" && doc.fileId
          ? `Move ${doc.id}.json to the trash of your Google Drive? You can restore it there for 30 days.`
          : "Delete this recipe from this browser? It cannot be restored.",
      confirmLabel: "Delete",
      onConfirm: () =>
        void run("Deleting…", async () => {
          if (current.kind === "drive") {
            if (doc.fileId) {
              await current.store.trash(doc.fileId);
            }
          } else {
            clearTimeout(saveTimers.current.get(doc.key));
            await drafts?.delete(doc.key);
          }
          removeFromList(doc);
        }),
    });
  };

  // ---- Google Drive ----

  /** Reads a Drive recipe's content; quiet: in the background, without the busy note (sync). */
  const loadDoc = async (key: string, quiet = false) => {
    const current = placeRef.current;
    if (current.kind !== "drive") {
      return;
    }
    const task = async () => {
      let read: { file: DriveFile; text: string };
      try {
        read = await current.store.read(key);
      } catch (e) {
        if (e instanceof DriveError && e.status === 404) {
          // Deleted or moved in Drive since the list was read.
          const gone = docsRef.current.find((d) => d.key === key);
          if (gone) {
            removeFromList(gone);
            setInfo(`${gone.id}.json is no longer in your Google Drive folder BrewberryPi/recipes (deleted or moved).`);
          }
          return;
        }
        throw e;
      }
      const { file, text } = read;
      let recipe = emptyRecipe();
      let loadError: string | undefined;
      let notice: string | undefined;
      try {
        const read = readRecipe(JSON.parse(text));
        recipe = read.recipe ?? recipe;
        loadError = read.error;
        notice = read.converted;
      } catch (e) {
        loadError = `${file.id}.json is not a JSON file (${message(e)}). Fix it in Google Drive, or replace it by saving this recipe.`;
      }
      const doc: Doc = { key, id: file.id, recipe, loaded: true, loadError, notice, fileId: file.fileId, version: file.version, updatedAt: Date.now() };
      const now = docsRef.current.find((d) => d.key === key);
      if (quiet && now && hasPendingChanges(now)) {
        return; // edited while it was being read: keep the edits (the version check on save decides)
      }
      // A converted file counts as changed, so saving writes it in the current format.
      putDoc({ ...doc, baseline: notice ? undefined : fingerprint(doc) });
    };
    if (quiet) {
      await task().catch(() => undefined); // tried again with the next sync
    } else {
      await run("Loading…", task);
    }
  };

  function selectDoc(key: string) {
    selectedRef.current = key;
    setSelectedKey(key);
    const doc = docsRef.current.find((d) => d.key === key);
    if (doc && !doc.loaded) {
      void loadDoc(key);
    }
  }

  /**
   * Reads the list from Drive and merges it into the open recipes (driveSync.ts). In the background (regular sync)
   * it runs only with a valid token and never reports errors: the next sync tries again.
   */
  const syncing = useRef<Promise<void> | undefined>(undefined);
  const syncDrive = async (store: DriveStore, background: boolean): Promise<void> => {
    if (syncing.current) {
      if (background) {
        return;
      }
      await syncing.current.catch(() => undefined); // a sync the user asked for waits for a background one
    }
    if (background && !auth.current.hasValidToken()) {
      return;
    }
    const task = syncOnce(store, background);
    syncing.current = task;
    try {
      await task;
    } finally {
      if (syncing.current === task) {
        syncing.current = undefined;
      }
    }
  };

  const syncOnce = async (store: DriveStore, background: boolean) => {
    try {
      const files = await store.list({ renew: !background });
      const current = placeRef.current;
      if (current.kind !== "drive" || current.store !== store) {
        return; // signed out meanwhile
      }
      const merge = mergeDriveList(docsRef.current, files);
      const next = sortDocs(merge.docs);
      setDocs(next);
      if (!next.some((d) => d.key === selectedRef.current)) {
        selectedRef.current = next[0]?.key;
        setSelectedKey(next[0]?.key);
      }
      const notes = [
        ...merge.removed.map((d) => `${d.id}.json`),
        ...merge.orphaned.map((d) => `${d.id}.json (your unsaved changes are kept)`),
      ];
      if (background && notes.length > 0) {
        setInfo(`Deleted or moved in your Google Drive: ${notes.join(", ")}.`);
      }
      const toLoad = new Set(merge.reload);
      const selected = next.find((d) => d.key === selectedRef.current);
      if (selected && !selected.loaded) {
        toLoad.add(selected.key);
      }
      for (const key of toLoad) {
        await loadDoc(key, background);
      }
    } catch (e) {
      if (!background) {
        throw e;
      }
    }
  };

  const showDrive = (store: DriveStore) => syncDrive(store, false);

  // Signed in: ask Drive's changes feed regularly and when the page comes back into view (another tab, device or
  // drive.google.com may have changed the folder); read the list again when it changed, and anyway now and then.
  useEffect(() => {
    if (place.kind !== "drive") {
      return;
    }
    const store = place.store;
    let lastPoll = Date.now();
    let lastFull = Date.now();
    let polling = false;
    const poll = async (minGapMs: number) => {
      if (polling || document.visibilityState !== "visible" || Date.now() - lastPoll < minGapMs || !auth.current.hasValidToken()) {
        return;
      }
      polling = true;
      lastPoll = Date.now();
      try {
        const listed = new Set(docsRef.current.flatMap((d) => (d.fileId ? [d.fileId] : [])));
        if ((await store.changedSince(listed)) || Date.now() - lastFull >= FULL_SYNC_MS) {
          lastFull = Date.now();
          await syncDrive(store, true);
        }
      } catch {
        // offline or token expired: the next poll tries again
      } finally {
        polling = false;
      }
    };
    const sync = (minGapMs: number) => void poll(minGapMs);
    const timer = setInterval(() => sync(0), CHANGE_POLL_MS);
    const onVisible = () => sync(5_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [place]);

  const signIn = (switchAccount = false) =>
    void run("Signing in with Google…", async () => {
      try {
        await (switchAccount ? auth.current.switchAccount() : auth.current.signIn());
      } catch (e) {
        if (e instanceof SignInError) {
          setError(e.message);
          return;
        }
        throw e;
      }
      await enterDrive(true);
    });

  /**
   * Shows the signed-in user's Drive recipes (the token is there already). After an interactive sign-in it offers
   * to save the browser drafts to Drive; a tab that takes over the stored token of another tab doesn't ask again.
   */
  const enterDrive = async (offerDrafts: boolean) => {
    const store = new DriveStore(auth.current);
    const { created } = await store.init();
    const sample = firstSample();
    if (created && sample) {
      await store.create(sample.id, sample.recipe); // EDT-016: the first sign-in gets an example, once
    }
    await store.startChanges();
    const account = await store.about();
    rememberHint(account.email);
    // Leave the browser drafts (they stay stored) and show the Drive recipes.
    saveTimers.current.forEach((t) => clearTimeout(t));
    saveTimers.current.clear();
    // The untouched sample of a first visit (EDT-016) is not offered: Drive has its own.
    const untouchedSample = sample ? fingerprint(newDoc(sample.id, sample.recipe)) : undefined;
    const browserDrafts = (offerDrafts ? ((await draftsRef.current?.all()) ?? docsRef.current) : []).filter(
      (d) => fingerprint(d) !== untouchedSample,
    );
    setDocs([]);
    placeRef.current = { kind: "drive", store, account };
    setPlace(placeRef.current);
    await showDrive(store);
    if (browserDrafts.length > 0) {
      setMigration({ drafts: sortDocs(browserDrafts), driveIds: new Set(docsRef.current.map((d) => d.id)) });
    }
  };

  /** Back to the browser drafts (signed out here or in another tab). */
  const leaveDrive = async () => {
    setDocs([]);
    selectedRef.current = undefined;
    setSelectedKey(undefined);
    placeRef.current = { kind: "browser" };
    setPlace(placeRef.current);
    const kept = sortDocs((await draftsRef.current?.all()) ?? []);
    setDocs(kept);
    setSelectedKey(kept[0]?.key);
  };

  const signOut = () => {
    const leave = () =>
      void run("Signing out…", async () => {
        auth.current.signOut(); // in every tab
        await leaveDrive();
      });
    if (docsRef.current.some(hasPendingChanges)) {
      setConfirmation({
        title: "Sign out",
        message: "Some recipes have changes that are not saved to Google Drive. Sign out and lose them?",
        confirmLabel: "Sign out",
        onConfirm: leave,
      });
    } else {
      leave();
    }
  };

  const saveToDrive = (doc: Doc, mode: "normal" | "overwrite" | "copy" = "normal") => {
    const current = placeRef.current;
    if (current.kind !== "drive") {
      return;
    }
    void run("Saving to Google Drive…", async () => {
      try {
        let file: DriveFile;
        let id = doc.id;
        if (mode === "copy") {
          const driveIds = (await current.store.list()).map((f) => f.id);
          id = freeId(doc.id, [...driveIds, ...takenIds()]);
          file = await current.store.create(id, doc.recipe);
        } else if (doc.fileId) {
          file = await current.store.update(doc.fileId, doc.id, doc.recipe, doc.version, mode === "overwrite");
        } else {
          file = await current.store.create(doc.id, doc.recipe);
        }
        const saved: Doc = { ...doc, key: file.fileId, id, fileId: file.fileId, version: file.version, loadError: undefined, notice: undefined, updatedAt: Date.now() };
        saved.baseline = fingerprint(saved);
        if (mode === "copy") {
          // Saved as a copy after a conflict: the original shows Drive's version again.
          putDoc(saved, true);
          if (doc.fileId) {
            await loadDoc(doc.fileId);
          }
        } else {
          replaceDoc(doc.key, saved);
        }
      } catch (e) {
        if (e instanceof VersionConflictError) {
          setConflict({ doc, file: e.file });
        } else if (e instanceof NameTakenError) {
          setError(`${e.message} Choose another file name.`);
        } else {
          throw e;
        }
      }
    });
  };

  const addFromDrive = () => {
    const current = placeRef.current;
    if (current.kind !== "drive") {
      return;
    }
    void run("Opening Google Drive…", async () => {
      const picked = await pickRecipeFiles(await auth.current.token(), current.store.recipesFolderId);
      if (picked.length === 0) {
        return;
      }
      const adopted = await current.store.adopt(picked);
      const known = new Set(docsRef.current.map((d) => d.key));
      setDocs(sortDocs([...docsRef.current, ...adopted.filter((f) => !known.has(f.fileId)).map(driveDoc)]));
      if (adopted[0]) {
        selectDoc(adopted[0].fileId);
      }
    });
  };

  const migrate = (choices: Map<string, MigrateChoice>) => {
    const current = placeRef.current;
    if (current.kind !== "drive" || !migration) {
      return;
    }
    void run("Saving to Google Drive…", async () => {
      const failures: string[] = [];
      const files = await current.store.list();
      const taken = files.map((f) => f.id);
      for (const draft of migration.drafts) {
        const choice = choices.get(draft.key) ?? "skip";
        try {
          if (choice === "save") {
            await current.store.create(draft.id, draft.recipe);
          } else if (choice === "copy") {
            const id = freeId(draft.id, taken);
            taken.push(id);
            await current.store.create(id, draft.recipe);
          } else if (choice === "overwrite") {
            const target = files.find((f) => f.id === draft.id);
            await (target ? current.store.update(target.fileId, draft.id, draft.recipe, undefined, true) : current.store.create(draft.id, draft.recipe));
          } else {
            continue;
          }
          await drafts?.delete(draft.key);
        } catch (e) {
          failures.push(`${draft.id}.json: ${message(e)}`);
        }
      }
      setMigration(undefined);
      await showDrive(current.store);
      if (failures.length > 0) {
        setError(`Not saved (still in this browser):\n${failures.join("\n")}`);
      }
    });
  };

  // ---- View ----

  const inDrive = place.kind === "drive";
  const isBusy = busy !== undefined;
  const status = (doc: Doc) => {
    const pending = hasPendingChanges(doc);
    const text = inDrive
      ? !doc.fileId
        ? "Not saved to Google Drive yet"
        : pending
          ? "Unsaved changes"
          : "Saved in Google Drive"
      : pending
        ? doc.baseline
          ? "Changed since download"
          : "Not downloaded yet"
        : "Downloaded";
    return (
      <span
        class={`rounded-full px-2.5 py-1 text-xs font-medium ${pending ? "bg-berry/10 text-berry dark:bg-berry-light/15 dark:text-berry-light" : "bg-leaf/10 text-leaf dark:bg-leaf-light/15 dark:text-leaf-light"}`}
      >
        {text}
      </span>
    );
  };

  return (
    <div
      class="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6"
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer?.files.length) {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }
      }}
    >
      <header class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <picture>
          <source srcset="/logo-dark.svg" media="(prefers-color-scheme: dark)" />
          <img src="/logo.svg" alt="BrewberryPi" class="h-9 w-auto sm:h-10" />
        </picture>
        <h1 class="font-brand text-xl font-medium text-stone-600 sm:text-2xl dark:text-stone-300">{APP_TITLE}</h1>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          {place.kind === "drive" ? (
            <>
              <span class="text-sm text-stone-600 dark:text-stone-300" title={place.account.name}>
                <span class="font-medium text-ink dark:text-ink-light">Cloud Sync: Google Drive</span> ·{" "}
                {place.account.email || place.account.name}
              </span>
              <button type="button" class={BUTTON_STYLES.secondary} disabled={isBusy} onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span class="text-sm font-medium text-stone-600 dark:text-stone-300">Cloud Sync</span>
              <GoogleSignInButton
              disabled={isBusy || !googleConfigured()}
              title={googleConfigured() ? undefined : "Google sign-in is not configured in this build."}
              onClick={() => signIn()}
              />
            </>
          )}
        </div>
      </header>

      <div class="mt-4 space-y-3">
        {place.kind === "browser" && drafts && <StorageBanner kind={drafts.kind} />}
        {place.kind === "drive" && (
          <p class={HINT_STYLE}>
            Cloud Sync is on: your recipes are files in your Google Drive, folder <strong>BrewberryPi/recipes</strong>. Recipe
            files you put there yourself appear here after you add them with “Add untracked file from cloud storage”.
          </p>
        )}
        {error && <ErrorBanner message={error} onClose={() => setError(undefined)} />}
        {info && <InfoBanner message={info} onClose={() => setInfo(undefined)} />}
        {busy && (
          <p class="text-sm text-stone-600 dark:text-stone-300" role="status">
            {busy}
          </p>
        )}
      </div>

      <div class="mt-4 grid flex-1 items-start gap-4 lg:grid-cols-[19rem_1fr]">
        <aside class={`${CARD_STYLE} min-w-0`} aria-label="Recipe list">
          <h2 class={TITLE_STYLE}>My Recipes</h2>
          <div class="mt-3">
            <RecipeList
              docs={docs}
              selectedKey={selectedKey}
              pendingLabel={inDrive ? "unsaved" : "not downloaded"}
              onSelect={selectDoc}
              onAction={onRecipeAction}
            />
          </div>
          <div class="mt-4 flex flex-wrap gap-2 border-t border-stone-200 pt-4 dark:border-white/10">
            <button type="button" class={BUTTON_STYLES.primary} disabled={isBusy} onClick={newRecipe}>
              New recipe
            </button>
            <button type="button" class={BUTTON_STYLES.secondary} disabled={isBusy} onClick={() => uploadInput.current?.click()}>
              Upload recipe
            </button>
            <input
              ref={uploadInput}
              type="file"
              accept=".json,application/json"
              multiple
              class="hidden"
              data-testid="upload"
              onChange={(e) => {
                const files = e.currentTarget.files;
                if (files?.length) {
                  void upload(Array.from(files));
                }
                e.currentTarget.value = "";
              }}
            />
          </div>
          <p class={`${HINT_STYLE} mt-2`}>You can also drop .json recipe files onto the page.</p>
          {inDrive && (
            <button
              type="button"
              class={`${LINK_STYLE} mt-3`}
              disabled={isBusy || !pickerConfigured()}
              title={pickerConfigured() ? undefined : "The Google Picker is not configured in this build."}
              onClick={addFromDrive}
            >
              Add untracked file from cloud storage
            </button>
          )}
        </aside>

        <main class="min-w-0">
          {selected?.loaded ? (
            <RecipeEditor
              doc={selected}
              status={status(selected)}
              onChange={(recipe) => change(selected, recipe)}
              actions={
                inDrive && (
                    <button
                      type="button"
                      class={BUTTON_STYLES.primary}
                      disabled={isBusy || problemsOf(selected).length > 0 || !hasPendingChanges(selected)}
                      onClick={() => saveToDrive(selected)}
                    >
                      Save to Google Drive
                    </button>
                )
              }
            />
          ) : selected ? (
            <section class={CARD_STYLE}>
              <p class="text-sm text-stone-600 dark:text-stone-300">Loading {selected.id}.json…</p>
            </section>
          ) : (
            <Intro />
          )}
        </main>
      </div>

      <footer class="mt-8 flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-200 py-4 text-xs text-stone-500 dark:border-white/10 dark:text-stone-400">
        <span>BrewberryPi Recipe Editor</span>
        <a class="underline" href="/privacy.html">
          Privacy
        </a>
        <a class="underline" href="/terms.html">
          Terms
        </a>
        <a class="underline" href="https://github.com/tinkerius/brewberrypi-recipeeditor">
          Source
        </a>
      </footer>

      {dragging && (
        <div class="pointer-events-none fixed inset-0 z-10 flex items-center justify-center bg-berry/10 text-lg font-medium text-berry ring-4 ring-berry/40 ring-inset dark:text-berry-light">
          Drop recipe files to open them
        </div>
      )}

      {confirmation && (
        <Modal
          title={confirmation.title}
          buttons={
            <>
              <button type="button" class={BUTTON_STYLES.secondary} autoFocus onClick={() => setConfirmation(undefined)}>
                Cancel
              </button>
              <button
                type="button"
                class={BUTTON_STYLES.dangerSolid}
                onClick={() => {
                  setConfirmation(undefined);
                  confirmation.onConfirm();
                }}
              >
                {confirmation.confirmLabel}
              </button>
            </>
          }
        >
          <p>{confirmation.message}</p>
        </Modal>
      )}

      {conflict && (
        <Modal
          title="Changed in Google Drive"
          buttons={
            <>
              <button type="button" class={BUTTON_STYLES.secondary} autoFocus onClick={() => setConflict(undefined)}>
                Cancel
              </button>
              <button
                type="button"
                class={BUTTON_STYLES.secondary}
                onClick={() => {
                  setConflict(undefined);
                  void loadDoc(conflict.doc.key);
                }}
              >
                Discard my changes
              </button>
              <button
                type="button"
                class={BUTTON_STYLES.secondary}
                onClick={() => {
                  setConflict(undefined);
                  saveToDrive(conflict.doc, "copy");
                }}
              >
                Save as a copy
              </button>
              <button
                type="button"
                class={BUTTON_STYLES.dangerSolid}
                onClick={() => {
                  setConflict(undefined);
                  saveToDrive(conflict.doc, "overwrite");
                }}
              >
                Overwrite
              </button>
            </>
          }
        >
          <p>
            {conflict.file.id}.json was changed in your Google Drive after you opened it (in another tab, on another device, or by
            someone else). Overwrite it with your version, save yours as a copy, or discard your changes and load the
            version from Google Drive.
          </p>
        </Modal>
      )}

      {nameRequest && nameDialog(nameRequest)}

      {migration && (
        <MigrateDialog drafts={migration.drafts} driveIds={migration.driveIds} busy={isBusy} onSave={migrate} onLater={() => setMigration(undefined)} />
      )}
    </div>
  );
}

function Intro() {
  return (
    <section class={CARD_STYLE}>
      <h2 class={TITLE_STYLE}>Recipes for your BrewberryPi</h2>
      <div class="mt-3 space-y-3 text-sm text-stone-700 dark:text-stone-300">
        <p>
          A recipe is the list of goals your BrewberryPi works through on brew day: heat up, mash in, rests, iodine test,
          lautering, cooking. Start a new recipe, or open recipe files (.json) you already have.
        </p>
        <p>
          To brew with a recipe, turn on Cloud Sync in the BrewberryPi app as well: the device then copies the recipes of
          your Google Drive folder <strong>BrewberryPi/recipes</strong> by itself. Without it, download the recipe's file
          and copy it into the <strong>app/recipes</strong> folder of your BrewberryPi's file share
          (<code>\\brewberrypi.local\config</code>, user <code>brewberry</code>); the app shows it within a few seconds.
        </p>
        <p>
          With Cloud Sync (Google Drive), your recipes are kept in your own Google Drive, folder <strong>BrewberryPi/recipes</strong>.
          Nothing is stored on a BrewberryPi server.
        </p>
      </div>
    </section>
  );
}
