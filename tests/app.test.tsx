// @vitest-environment jsdom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { newDoc } from "../src/doc";
import { MemoryStore, type DraftStore } from "../src/store/BrowserStore";
import { BROWSER_STORAGE_WARNING, MEMORY_STORAGE_WARNING } from "../src/ui/Banners";

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
});

afterEach(() => {
  render(null, root);
  root.remove();
});

async function show(drafts: DraftStore) {
  await act(async () => {
    render(<App openDrafts={async () => drafts} />, root);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function dialogText(): string {
  return root.querySelector("[role=dialog]")?.textContent ?? "";
}

/** Types the file name into the open name dialog and confirms it. */
async function nameAs(id: string, confirm: string) {
  const input = root.querySelector<HTMLInputElement>("[role=dialog] input");
  if (!input) {
    throw new Error("no name dialog");
  }
  await act(async () => {
    input.value = id;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => button(confirm).click());
}

/** Opens the menu of a recipe in the list and picks an action. */
async function menu(recipeTitle: string, item: string) {
  const opener = root.querySelector<HTMLButtonElement>(`button[aria-label="Actions for ${recipeTitle}"]`);
  if (!opener) {
    throw new Error(`no menu for ${recipeTitle}`);
  }
  await act(async () => opener.click());
  const entry = [...root.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].find((b) => b.textContent === item);
  if (!entry) {
    throw new Error(`no menu item ${item}`);
  }
  await act(async () => entry.click());
}

function listText(): string[] {
  return [...root.querySelectorAll("[aria-label=Recipes] li")].map((li) => li.querySelector("button")?.textContent ?? "");
}

function button(label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!found) {
    throw new Error(`no button ${label}`);
  }
  return found;
}

describe("App, signed out", () => {
  it("ACC-021 warns that recipes live only in this tab without browser storage", async () => {
    await show(new MemoryStore());
    expect(root.textContent).toContain(MEMORY_STORAGE_WARNING);
  });

  it("ACC-021 warns that browser storage can be lost", async () => {
    const store = new MemoryStore();
    Object.defineProperty(store, "kind", { value: "best-effort" });
    await show(store);
    expect(root.textContent).toContain(BROWSER_STORAGE_WARNING);
  });

  it("ACC-010 asks for the file name, then starts a new recipe empty and incomplete; it can't be downloaded yet", async () => {
    await show(new MemoryStore());
    await act(async () => button("New recipe").click());
    await nameAs("Weizen", "Create");
    expect(root.querySelector("[aria-label=Recipe]")?.textContent).toContain("Weizen.json");
    expect(root.querySelector("[aria-label=Recipe] input")?.getAttribute("placeholder")).not.toBe("e.g. Weizen"); // no file name field
    expect(root.textContent).toContain("Incomplete");
    expect(root.textContent).toContain("The recipe needs a name.");
    expect(button("Download Weizen.json").disabled).toBe(true);
    expect(root.textContent).toContain("Not downloaded yet");
  });

  it("ACC-011 refuses a file name that is invalid or taken", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept", mashing_process: { goals: [] } }));
    await show(store);
    await act(async () => button("New recipe").click());
    await nameAs("Kept", "Create");
    expect(dialogText()).toContain("There already is a recipe Kept.json.");
    await nameAs("with space", "Create");
    expect(dialogText()).toContain("may only contain");
    expect(root.querySelectorAll("[aria-label=Recipes] li")).toHaveLength(1);
  });

  it("ACC-023 shows the drafts kept in the browser, marked when not downloaded", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
    await show(store);
    expect(root.querySelector("[aria-label=Recipes]")?.textContent).toContain("Kept recipe");
    expect(root.querySelector("[aria-label=Recipes]")?.textContent).toContain("not downloaded");
    expect(root.textContent).toContain("Complete: BrewberryPi can load this recipe.");
  });
});

describe("App, a recipe without goals (app Q-34)", () => {
  it("ACC-009 is valid and can be downloaded, with a note that the app can't brew it yet", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Draft", { version: 2, name: "Draft", mashing_process: { goals: [] } }));
    await show(store);
    expect(root.textContent).toContain("It has no goals yet, so BrewberryPi lists it but can't brew it.");
    expect(button("Download Draft.json").disabled).toBe(false);
  });
});

describe("App, the recipe menu", () => {
  async function withKept() {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
    await show(store);
    return store;
  }

  it("ACC-012 renames a recipe, asking for the new file name", async () => {
    const store = await withKept();
    await menu("Kept recipe", "Rename…");
    expect(dialogText()).toContain("Rename Kept.json");
    await nameAs("Renamed", "Rename");
    expect(listText()).toEqual([expect.stringContaining("Renamed.json")]);
    await act(async () => new Promise((r) => setTimeout(r, 250))); // the draft is stored after a short delay
    expect((await store.all()).map((d) => d.id)).toEqual(["Renamed"]);
  });

  it("ACC-013 duplicates a recipe under a new file name", async () => {
    await withKept();
    await menu("Kept recipe", "Duplicate…");
    expect(root.querySelector<HTMLInputElement>("[role=dialog] input")?.value).toBe("Kept-2");
    await act(async () => button("Duplicate").click());
    expect(listText()).toEqual([expect.stringContaining("Kept.json"), expect.stringContaining("Kept-2.json")]);
    expect(root.querySelector("[aria-label=Recipe]")?.textContent).toContain("Kept-2.json");
  });

  it("ACC-014 deletes a recipe after asking", async () => {
    await withKept();
    await menu("Kept recipe", "Delete…");
    expect(dialogText()).toContain("Delete this recipe");
    await act(async () => {
      [...root.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find((b) => b.textContent === "Delete")?.click();
    });
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(listText()).toEqual([]);
  });

  it("ACC-015 opens with a right click too", async () => {
    await withKept();
    await act(async () => {
      root.querySelector("[aria-label=Recipes] li")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    expect(root.querySelector("[role=menu]")?.getAttribute("aria-label")).toBe("Actions for Kept recipe");
  });
});
