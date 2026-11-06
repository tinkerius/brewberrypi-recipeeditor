/**
 * The recipe editor. Signed out, recipes are drafts in this browser (BrowserStore) that the user downloads one by
 * one; signed in with Google, they are files in the user's Google Drive, BrewberryPi/recipes (DriveStore).
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { GoogleAuth, SignInError, rememberHint } from "./auth/google";
import { googleConfigured, pickerConfigured } from "./config";
import { fingerprint, freeId, hasPendingChanges, newDoc, problemsOf, type Doc } from "./doc";
import { pickRecipeFiles } from "./drive/picker";
import { downloadRecipe, readRecipeFile } from "./file";
import { emptyRecipe, readRecipe, type Recipe } from "./model";
import { SAMPLES } from "./samples";
import { openDraftStore, type DraftStore } from "./store/BrowserStore";
import { DriveStore, NameTakenError, VersionConflictError, type DriveFile } from "./store/DriveStore";
import { ErrorBanner, StorageBanner } from "./ui/Banners";
import { MigrateDialog, type MigrateChoice } from "./ui/MigrateDialog";
import { Modal } from "./ui/Modal";
import { RecipeEditor } from "./ui/RecipeEditor";
import { RecipeList } from "./ui/RecipeList";
import { BUTTON_STYLES, CARD_STYLE, HINT_STYLE, SELECT_STYLE, TITLE_STYLE } from "./ui/styles";

export const APP_TITLE = "Recipe Editor";
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

function driveDoc(file: DriveFile): Doc {
  return { key: file.fileId, id: file.id, recipe: emptyRecipe(), loaded: false, fileId: file.fileId, version: file.version, updatedAt: 0 };
}

export function App(props: { openDrafts?: () => Promise<DraftStore>; auth?: GoogleAuth }) {
  const [drafts, setDrafts] = useState<DraftStore>();
  const [place, setPlace] = useState<Place>({ kind: "browser" });
  const [docs, setDocsState] = useState<Doc[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [storageFailed, setStorageFailed] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [conflict, setConflict] = useState<{ doc: Doc; file: DriveFile }>();
  const [migration, setMigration] = useState<{ drafts: Doc[]; driveIds: Set<string> }>();
  const [dragging, setDragging] = useState(false);
  const auth = useRef(props.auth ?? new GoogleAuth());
  const uploadInput = useRef<HTMLInputElement>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Async handlers read the latest state through refs.
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const placeRef = useRef(place);
  placeRef.current = place;
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
      setDrafts(store);
      try {
        const kept = sortDocs(await store.all());
        setDocs(kept);
        setSelectedKey(kept[0]?.key);
      } catch (e) {
        setError(`Could not read the recipes stored in this browser: ${message(e)}`);
      }
    })();
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

  const newRecipe = () => putDoc(newDoc("", emptyRecipe()), true);

  const newFromSample = (id: string) => {
    const sample = SAMPLES.find((s) => s.id === id);
    if (sample) {
      putDoc(newDoc(freeId(sample.id, takenIds()), structuredClone(sample.recipe)), true);
    }
  };

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

  const change = (doc: Doc, id: string, recipe: Recipe) => putDoc({ ...doc, id, recipe, updatedAt: Date.now() });

  const download = (doc: Doc) => {
    downloadRecipe(doc.id, doc.recipe);
    if (placeRef.current.kind === "browser") {
      putDoc({ ...doc, notice: undefined, baseline: fingerprint(doc) });
    }
  };

  const duplicate = (doc: Doc) => putDoc(newDoc(freeId(doc.id || "recipe", takenIds()), structuredClone(doc.recipe)), true);

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

  const clearDrafts = () =>
    setConfirmation({
      title: "Delete all recipes in this browser",
      message: `Delete all ${docs.length} recipes stored in this browser? Downloaded files are not affected.`,
      confirmLabel: "Delete all",
      onConfirm: () =>
        void run("Deleting…", async () => {
          saveTimers.current.forEach((t) => clearTimeout(t));
          saveTimers.current.clear();
          await drafts?.clear();
          setDocs([]);
          setSelectedKey(undefined);
        }),
    });

  // ---- Google Drive ----

  const loadDoc = async (key: string) => {
    const current = placeRef.current;
    if (current.kind !== "drive") {
      return;
    }
    await run("Loading…", async () => {
      const { file, text } = await current.store.read(key);
      let recipe = emptyRecipe();
      let loadError: string | undefined;
      let notice: string | undefined;
      try {
        const read = readRecipe(JSON.parse(text));
        recipe = read.recipe ?? recipe;
        loadError = read.error;
        notice = read.converted;
      } catch (e) {
        loadError = `${file.id}.json is not a JSON file (${message(e)}). Fix it in Drive, or replace it by saving this recipe.`;
      }
      const doc: Doc = { key, id: file.id, recipe, loaded: true, loadError, notice, fileId: file.fileId, version: file.version, updatedAt: Date.now() };
      // A converted file counts as changed, so saving writes it in the current format.
      putDoc({ ...doc, baseline: notice ? undefined : fingerprint(doc) });
    });
  };

  function selectDoc(key: string) {
    selectedRef.current = key;
    setSelectedKey(key);
    const doc = docsRef.current.find((d) => d.key === key);
    if (doc && !doc.loaded) {
      void loadDoc(key);
    }
  }

  const showDrive = async (store: DriveStore) => {
    const files = await store.list();
    // Keep recipes not saved yet, and changes not saved yet.
    const unsaved = docsRef.current.filter((d) => hasPendingChanges(d));
    const unsavedKeys = new Set(unsaved.map((d) => d.key));
    const next = sortDocs([...unsaved, ...files.filter((f) => !unsavedKeys.has(f.fileId)).map(driveDoc)]);
    setDocs(next);
    const keep = next.find((d) => d.key === selectedRef.current) ?? next[0];
    setSelectedKey(keep?.key);
    if (keep && !keep.loaded) {
      await loadDoc(keep.key);
    }
  };

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
      const store = new DriveStore(auth.current);
      await store.init();
      const account = await store.about();
      rememberHint(account.email);
      // Leave the browser drafts (they stay stored) and show the Drive recipes.
      saveTimers.current.forEach((t) => clearTimeout(t));
      saveTimers.current.clear();
      const browserDrafts = (await drafts?.all()) ?? docsRef.current;
      setDocs([]);
      placeRef.current = { kind: "drive", store, account };
      setPlace(placeRef.current);
      await showDrive(store);
      if (browserDrafts.length > 0) {
        setMigration({ drafts: sortDocs(browserDrafts), driveIds: new Set(docsRef.current.map((d) => d.id)) });
      }
    });

  const signOut = () => {
    const leave = () =>
      void run("Signing out…", async () => {
        auth.current.signOut();
        // Drop the Drive recipes before the page shows browser drafts again.
        setDocs([]);
        selectedRef.current = undefined;
        setSelectedKey(undefined);
        placeRef.current = { kind: "browser" };
        setPlace(placeRef.current);
        const kept = sortDocs((await drafts?.all()) ?? []);
        setDocs(kept);
        setSelectedKey(kept[0]?.key);
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

  const refresh = () => {
    const current = placeRef.current;
    if (current.kind === "drive") {
      void run("Loading from Google Drive…", () => showDrive(current.store));
    }
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
        ? "Not saved to Drive yet"
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
                {place.account.email || place.account.name}
              </span>
              <button type="button" class={BUTTON_STYLES.secondary} disabled={isBusy} onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              class={BUTTON_STYLES.primary}
              disabled={isBusy || !googleConfigured()}
              title={googleConfigured() ? undefined : "Google sign-in is not configured in this build."}
              onClick={() => signIn()}
            >
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      <div class="mt-4 space-y-3">
        {place.kind === "browser" && drafts && <StorageBanner kind={drafts.kind} />}
        {place.kind === "drive" && (
          <p class={HINT_STYLE}>
            Your recipes are files in your Google Drive, folder <strong>BrewberryPi/recipes</strong>. Recipe files you put there
            yourself appear here after you add them with “Add files from Drive”.
          </p>
        )}
        {error && <ErrorBanner message={error} onClose={() => setError(undefined)} />}
        {busy && (
          <p class="text-sm text-stone-600 dark:text-stone-300" role="status">
            {busy}
          </p>
        )}
      </div>

      <div class="mt-4 grid flex-1 items-start gap-4 lg:grid-cols-[19rem_1fr]">
        <aside class={`${CARD_STYLE} min-w-0`} aria-label="Recipe list">
          <div class="flex items-center justify-between gap-2">
            <h2 class={TITLE_STYLE}>{inDrive ? "In your Drive" : "In this browser"}</h2>
            {inDrive && (
              <button type="button" class={BUTTON_STYLES.small} title="Reload the list from Google Drive" disabled={isBusy} onClick={refresh}>
                ↻
              </button>
            )}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class={BUTTON_STYLES.primary} disabled={isBusy} onClick={newRecipe}>
              New recipe
            </button>
            <button type="button" class={BUTTON_STYLES.secondary} disabled={isBusy} onClick={() => uploadInput.current?.click()}>
              Upload files
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
            <select
              class={`${SELECT_STYLE} w-full`}
              aria-label="New recipe from a sample"
              disabled={isBusy}
              value=""
              onChange={(e) => {
                newFromSample(e.currentTarget.value);
                e.currentTarget.value = "";
              }}
            >
              <option value="">New from a sample recipe…</option>
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.recipe.name}
                </option>
              ))}
            </select>
            {inDrive && (
              <button
                type="button"
                class={`${BUTTON_STYLES.secondary} w-full`}
                disabled={isBusy || !pickerConfigured()}
                title={pickerConfigured() ? undefined : "The Google Picker is not configured in this build."}
                onClick={addFromDrive}
              >
                Add files from Drive
              </button>
            )}
          </div>
          <p class={`${HINT_STYLE} mt-2`}>You can also drop .json recipe files onto the page.</p>
          <div class="mt-4 border-t border-stone-200 pt-3 dark:border-white/10">
            <RecipeList
              docs={docs}
              selectedKey={selectedKey}
              pendingLabel={inDrive ? "unsaved" : "not downloaded"}
              onSelect={selectDoc}
            />
          </div>
          {!inDrive && docs.length > 0 && (
            <button type="button" class={`${BUTTON_STYLES.danger} mt-4 w-full`} disabled={isBusy} onClick={clearDrafts}>
              Delete all recipes in this browser
            </button>
          )}
        </aside>

        <main class="min-w-0">
          {selected?.loaded ? (
            <RecipeEditor
              doc={selected}
              status={status(selected)}
              onChange={(id, recipe) => change(selected, id, recipe)}
              actions={
                <>
                  {inDrive && (
                    <button
                      type="button"
                      class={BUTTON_STYLES.primary}
                      disabled={isBusy || problemsOf(selected).length > 0 || !hasPendingChanges(selected)}
                      onClick={() => saveToDrive(selected)}
                    >
                      Save to Drive
                    </button>
                  )}
                  <button
                    type="button"
                    class={inDrive ? BUTTON_STYLES.secondary : BUTTON_STYLES.primary}
                    disabled={isBusy || problemsOf(selected).length > 0}
                    onClick={() => download(selected)}
                  >
                    Download {selected.id ? `${selected.id}.json` : "file"}
                  </button>
                  <button type="button" class={BUTTON_STYLES.secondary} disabled={isBusy} onClick={() => duplicate(selected)}>
                    Duplicate
                  </button>
                  <button type="button" class={`${BUTTON_STYLES.danger} sm:ml-auto`} disabled={isBusy} onClick={() => remove(selected)}>
                    Delete
                  </button>
                </>
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
            version from Drive.
          </p>
        </Modal>
      )}

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
          lautering, cooking. Start a new recipe, begin from a sample, or open recipe files (.json) you already have.
        </p>
        <p>
          To brew with a recipe, download its file and copy it into the <strong>app/recipes</strong> folder of your
          BrewberryPi's file share (<code>\\brewberrypi.local\config</code>, user <code>brewberry</code>). The
          app shows it in its process list within a few seconds.
        </p>
        <p>
          Signed in with Google, your recipes are kept in your own Google Drive, folder <strong>BrewberryPi/recipes</strong>.
          Nothing is stored on a BrewberryPi server.
        </p>
      </div>
    </section>
  );
}
