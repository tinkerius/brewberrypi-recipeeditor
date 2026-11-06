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
    expect(root.textContent).toContain("Not downloaded yet");
    const actions = [...root.querySelectorAll("[aria-label=Recipe] button")].map((b) => b.textContent);
    expect(actions.filter((t) => /Download|Delete/.test(t ?? ""))).toEqual([]); // only in the menu (GUI-031)
    await menu("Weizen", "Download"); // listed by its file name while it has no name
    expect(root.querySelector("[role=alert]")?.textContent).toContain("Weizen.json is incomplete; fix it before downloading.");
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
    // jsdom has no object URLs: count the downloads instead.
    let downloads = 0;
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined });
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download === "Draft.json") {
        downloads++;
      }
    };
    await menu("Draft", "Download");
    HTMLAnchorElement.prototype.click = click;
    expect(downloads).toBe(1);
    expect(root.querySelector("[role=alert]")).toBeNull();
    expect(root.textContent).toContain("Downloaded");
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

describe("App, a new workspace and the list layout", () => {
  it("ACC-018 gets the sample BENIWEISS on the first visit, and nothing on a later one", async () => {
    const first = new MemoryStore(); // a new browser storage
    await show(first);
    expect(listText()).toEqual([expect.stringContaining("BENIWEISS.json")]);
    expect((await first.all()).map((d) => d.id)).toEqual(["BENIWEISS"]);
    render(null, root);

    const later = new MemoryStore();
    Object.defineProperty(later, "firstUse", { value: false });
    await show(later);
    expect(listText()).toEqual([]);
  });

  it("ACC-019 is titled My Recipes, with New recipe and Upload recipe below the recipes and no sample menu", async () => {
    await show(new MemoryStore());
    const panel = root.querySelector("[aria-label='Recipe list']")!;
    expect(panel.querySelector("h2")?.textContent).toBe("My Recipes");
    const list = panel.querySelector("[aria-label=Recipes]")!;
    for (const label of ["New recipe", "Upload recipe"]) {
      const b = button(label);
      expect(list.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(root.textContent).not.toContain("New from a sample recipe");
    expect(root.querySelector("select[aria-label='New recipe from a sample']")).toBeNull();
  });
});

describe("App, the name Cloud Sync (QE-18)", () => {
  it("ACC-037 names the feature Cloud Sync and the provider Google Drive in full", async () => {
    await show(new MemoryStore());
    const header = root.querySelector("header")!;
    expect(header.textContent).toContain("Cloud Sync");
    expect(header.textContent).toContain("Sign in with Google");
    expect(root.querySelector("[role=note]")?.textContent).toContain("Cloud Sync is off");
    expect(root.textContent!.match(/(?<!Google )\bDrive\b/g) ?? []).toEqual([]);
  });
});

describe("App, reordering goals by drag and drop (EDT-012)", () => {
  const goals = [
    { type: "HeatUp", temperature: 40 },
    { type: "MashIn" },
    { type: "Lautering" },
  ];

  async function withThreeGoals() {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept", mashing_process: { goals } }));
    await show(store);
  }

  const goalTypes = () =>
    [...root.querySelectorAll<HTMLElement>("[aria-label=Recipe] [data-goal-type]")].map((b) => b.dataset.goalType);
  const handles = () => [...root.querySelectorAll<HTMLButtonElement>("[data-drag-handle]")];

  /** Gives the goal cards a layout (jsdom has none): card i spans y = 100·i … 100·i + 80. */
  function layOut() {
    root.querySelectorAll("[aria-label=Recipe] ol > li").forEach((li, i) => {
      li.getBoundingClientRect = () => ({ top: i * 100, height: 80, bottom: i * 100 + 80, left: 0, right: 100, width: 100, x: 0, y: i * 100, toJSON: () => ({}) });
    });
  }

  function pointer(target: Element, type: string, clientY: number) {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 }));
  }

  it("ACC-038 drags goal 1 below goal 3, with a drop line while dragging; no arrow buttons", async () => {
    await withThreeGoals();
    expect(goalTypes()).toEqual(["HeatUp", "MashIn", "Lautering"]);
    expect(root.querySelector("[aria-label='Move up'], [aria-label='Move down']")).toBeNull();
    layOut();
    const handle = handles()[0];
    await act(async () => pointer(handle, "pointerdown", 40));
    await act(async () => pointer(handle, "pointermove", 270));
    expect(root.querySelectorAll("[data-drop-line]")).toHaveLength(1);
    await act(async () => pointer(handle, "pointerup", 270));
    expect(goalTypes()).toEqual(["MashIn", "Lautering", "HeatUp"]);
    expect(root.querySelectorAll("[data-drop-line]")).toHaveLength(0);
  });

  it("ACC-038 changes nothing when dropped at its own place or cancelled", async () => {
    await withThreeGoals();
    layOut();
    const handle = handles()[1];
    await act(async () => pointer(handle, "pointerdown", 140));
    await act(async () => pointer(handle, "pointermove", 160));
    expect(root.querySelectorAll("[data-drop-line]")).toHaveLength(0);
    await act(async () => pointer(handle, "pointerup", 160));
    expect(goalTypes()).toEqual(["HeatUp", "MashIn", "Lautering"]);
    await act(async () => pointer(handle, "pointerdown", 140));
    await act(async () => pointer(handle, "pointermove", 70));
    await act(async () => pointer(handle, "pointercancel", 70));
    expect(goalTypes()).toEqual(["HeatUp", "MashIn", "Lautering"]);
  });

  it("ACC-039 moves a goal with the arrow keys on its handle, which keeps the focus", async () => {
    await withThreeGoals();
    await act(async () => {
      handles()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(goalTypes()).toEqual(["MashIn", "HeatUp", "Lautering"]);
    expect(document.activeElement).toBe(handles()[0]);
    await act(async () => {
      handles()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(goalTypes()).toEqual(["MashIn", "HeatUp", "Lautering"]);
  });
});

describe("App, editing the recipe name in the title (EDT-010)", () => {
  const nameInput = () => root.querySelector<HTMLInputElement>("[aria-label=Recipe] input[aria-label='Recipe name']");
  const titleButton = () => root.querySelector<HTMLButtonElement>("[aria-label=Recipe] button[aria-label^='Edit recipe name']");

  async function type(text: string) {
    await act(async () => {
      nameInput()!.value = text;
      nameInput()!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function key(name: string) {
    await act(async () => {
      nameInput()!.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
    });
  }

  it("ACC-042 clicking the name opens a field; Enter keeps the new name, Escape restores the old one", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
    await show(store);
    expect(nameInput()).toBeNull(); // no separate name field
    expect(titleButton()?.textContent).toContain("Kept recipe");

    await act(async () => titleButton()!.click());
    expect(document.activeElement).toBe(nameInput());
    await type("Hefeweizen");
    await key("Enter");
    expect(nameInput()).toBeNull();
    expect(titleButton()?.textContent).toContain("Hefeweizen");
    expect(listText()).toEqual([expect.stringContaining("Hefeweizen")]);

    await act(async () => titleButton()!.click());
    await type("Something else");
    await key("Escape");
    expect(titleButton()?.textContent).toContain("Hefeweizen");
  });

  it("ACC-042 a new recipe opens with the name field focused", async () => {
    await show(new MemoryStore());
    await act(async () => button("New recipe").click());
    await nameAs("Weizen", "Create");
    expect(nameInput()).not.toBeNull();
    expect(document.activeElement).toBe(nameInput());
  });
});

describe("App, choosing a goal's type in a dialog (QE-23)", () => {
  const goalTypes = () =>
    [...root.querySelectorAll<HTMLElement>("[aria-label=Recipe] [data-goal-type]")].map((b) => b.dataset.goalType);
  /** The dialog's choice with this display name. */
  const dialogChoice = (label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>("[role=dialog] [aria-label='Goal types'] button")].find(
      (b) => b.querySelector("span")?.textContent === label,
    )!;

  it("ACC-043 asks for the type when a goal is added and when the pencil is used; no type dropdowns", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept", mashing_process: { goals: [{ type: "HeatUp", temperature: 40 }] } }));
    await show(store);
    expect(root.querySelectorAll("[aria-label=Recipe] select")).toHaveLength(0);

    await act(async () => button("+ Add goal").click());
    expect(root.querySelector("[role=dialog]")?.textContent).toContain("Add a goal");
    await act(async () => button("Cancel").click());
    expect(goalTypes()).toEqual(["HeatUp"]);
    await act(async () => button("+ Add goal").click());
    await act(async () => dialogChoice("Rest").click());
    expect(goalTypes()).toEqual(["HeatUp", "Rest"]);

    const pencil = root.querySelector<HTMLButtonElement>("[aria-label^='Change the type of goal 1']")!;
    await act(async () => pencil.click());
    expect(dialogChoice("Heat Up").getAttribute("aria-current")).toBe("true");
    await act(async () => dialogChoice("Rest").click());
    expect(goalTypes()).toEqual(["Rest", "Rest"]);
    const temperature = root.querySelector<HTMLInputElement>("[aria-label=Recipe] ol > li input")!;
    expect(temperature.value).toBe("40"); // kept (EDT-014)
  });
});

describe("App, no technical goal type names (QE-24)", () => {
  // The type names that differ from their display names ("Rest" and "Lautering" are both).
  const TECHNICAL = /\b(PourInBrewingWater|HeatUp|MashIn|IodineTest|HeatUpForHopsCooking|CookWater)\b/;

  it("ACC-044 shows display names only: goal list, type dialog and problems", async () => {
    const store = new MemoryStore();
    const goals = [
      { type: "PourInBrewingWater" },
      { type: "HeatUp" }, // a problem: no temperature
      { type: "MashIn" },
      { type: "IodineTest", temperature: 68, minutes: 10 },
      { type: "HeatUpForHopsCooking" },
      { type: "CookWater", name: "Cook", description: "Cook", minutes: 10 },
    ];
    await store.put(newDoc("Kept", { version: 2, name: "Kept", mashing_process: { goals } }));
    await show(store);
    expect(root.textContent).toContain("A Heat Up goal needs a temperature.");
    expect(root.textContent).not.toMatch(TECHNICAL);
    await act(async () => button("+ Add goal").click());
    expect(root.querySelector("[role=dialog]")?.textContent).toContain("Heat Up (hops cooking)");
    expect(root.textContent).not.toMatch(TECHNICAL);
  });
});
