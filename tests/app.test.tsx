// @vitest-environment jsdom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { newDoc } from "../src/doc";
import { MemoryStore, type DraftStore } from "../src/store/BrowserStore";
import { GoogleAuth, TOKEN_KEY } from "../src/auth/google";
import { DriveStore } from "../src/store/DriveStore";
import { FakeAuth, FakeDrive } from "./fakeDrive";
import { BROWSER_STORAGE_WARNING, MEMORY_STORAGE_WARNING } from "../src/ui/Banners";
import { SIDEBAR_KEY } from "../src/ui/sidebar";

let root: HTMLElement;

beforeEach(() => {
  localStorage.removeItem(SIDEBAR_KEY);
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

describe("App, the website's top bar and footer (QE-27)", () => {
  it("ACC-047 links BrewberryPi to brewberrypi.org, names the editor and Cloud Sync; the footer has its links", async () => {
    await show(new MemoryStore());
    const header = root.querySelector("header")!;
    const brand = header.querySelector<HTMLAnchorElement>("a[href='https://brewberrypi.org/']")!;
    expect(brand.textContent).toBe("BrewberryPi");
    expect(brand.querySelector("b")?.textContent).toBe("Pi");
    expect(header.querySelector("h1")?.textContent).toBe("Recipe Editor");
    expect(header.textContent).toContain("Cloud Sync");
    const links = [...root.querySelectorAll<HTMLAnchorElement>("footer a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["brewberrypi.org", "https://brewberrypi.org/"],
      ["Privacy", "/privacy.html"],
      ["Terms", "/terms.html"],
      ["Source code", "https://github.com/tinkerius/brewberrypi-recipeeditor"],
    ]);
  });
});

describe("App, the recipe's tabs (QE-28)", () => {
  it("ACC-048 shows one selected tab Mash Process with the goals; the problems are below it", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept", mashing_process: { goals: [{ type: "HeatUp" }] } }));
    await show(store);
    const recipe = root.querySelector("[aria-label=Recipe]")!;
    const tabs = [...recipe.querySelectorAll<HTMLElement>("[role=tablist] [role=tab]")];
    expect(tabs.map((t) => [t.textContent, t.getAttribute("aria-selected")])).toEqual([["Mash Process", "true"]]);
    const panel = recipe.querySelector<HTMLElement>("[role=tabpanel]")!;
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs[0].id);
    expect(panel.querySelector("ol [data-goal-line]")).not.toBeNull();
    expect([...panel.querySelectorAll("button")].some((b) => b.textContent?.trim() === "+ Add goal")).toBe(true);
    expect(panel.textContent).not.toContain("A Heat Up goal needs a temperature.");
    expect(recipe.textContent).toContain("A Heat Up goal needs a temperature.");
  });
});

describe("App, the collapsible recipe list (QE-29)", () => {
  const sidebar = () => root.querySelector<HTMLElement>("#recipe-sidebar")!;
  const ctrlB = async () =>
    act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true }));
    });

  it("ACC-049 collapses to a strip, is remembered, shows unsaved work, and Ctrl+B expands it", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
    await show(store);
    expect(listText()).toHaveLength(1);
    await act(async () => sidebar().querySelector<HTMLButtonElement>("[aria-label='Hide sidebar']")!.click());

    expect(root.querySelector("[aria-label=Recipes]")).toBeNull(); // the list is gone
    expect(sidebar().querySelector("[aria-label='Show sidebar']")?.getAttribute("aria-expanded")).toBe("false");
    expect(sidebar().querySelector("[aria-label='New recipe']")).not.toBeNull();
    expect(sidebar().querySelector("[data-pending-dot]")?.getAttribute("title")).toBe("1 recipe not downloaded");
    expect(root.querySelector("[aria-label=Recipe]")?.textContent).toContain("Kept recipe"); // still shown
    expect(localStorage.getItem(SIDEBAR_KEY)).toBe("collapsed");

    render(null, root);
    await show(store);
    expect(sidebar().querySelector("[aria-label='Show sidebar']")).not.toBeNull(); // remembered

    await act(async () => sidebar().querySelector<HTMLButtonElement>("[aria-label='New recipe']")!.click());
    expect(root.querySelector("[role=dialog]")).not.toBeNull();
    await ctrlB();
    expect(sidebar().querySelector("[aria-label='Show sidebar']")).not.toBeNull(); // not while a dialog is open
    await act(async () => button("Cancel").click());

    await ctrlB();
    expect(sidebar().querySelector("[aria-label='Hide sidebar']")?.getAttribute("aria-expanded")).toBe("true");
    expect(listText()).toHaveLength(1);
    expect(localStorage.getItem(SIDEBAR_KEY)).toBeNull();
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

    expect(root.querySelector("[aria-label^='Change the type of goal 1']")).toBeNull(); // only on an open goal
    await act(async () => root.querySelector<HTMLButtonElement>("[aria-label=Recipe] ol > li [data-goal-line]")!.click());
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

describe("App, one line per goal (QE-26)", () => {
  const items = () => [...root.querySelectorAll<HTMLElement>("[aria-label=Recipe] ol > li")];
  const lines = () => items().map((li) => li.querySelector("[data-goal-line] > span")!.textContent!.trim());
  const openGoals = () => items().flatMap((li, i) => (li.querySelector("input") ? [i] : []));
  const click = async (i: number) => act(async () => items()[i].querySelector<HTMLButtonElement>("[data-goal-line]")!.click());

  async function withGoals(goals: { type: string; [field: string]: unknown }[]) {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 2, name: "Kept", mashing_process: { goals } }));
    await show(store);
  }

  it("ACC-046 shows each goal as one line; clicking opens it and closes the other; a new goal is open", async () => {
    await withGoals([
      { type: "HeatUp", temperature: 40 },
      { type: "Rest", temperature: 65, minutes: 30, name: "Maltoserast", description: "Maltoserast @65 for 30min" },
    ]);
    expect(lines()).toEqual(["Heat Up to 40 °C", "Rest at 65 °C for 30 min — Maltoserast"]);
    expect(openGoals()).toEqual([]);
    await click(1);
    expect(openGoals()).toEqual([1]);
    expect(items()[1].querySelector("[data-goal-line]")!.getAttribute("aria-expanded")).toBe("true");
    await click(0);
    expect(openGoals()).toEqual([0]);
    await click(0);
    expect(openGoals()).toEqual([]);
    await act(async () => button("+ Add goal").click());
    await act(async () =>
      [...root.querySelectorAll<HTMLButtonElement>("[role=dialog] [aria-label='Goal types'] button")]
        .find((b) => b.querySelector("span")?.textContent === "Iodine Test")!
        .click(),
    );
    expect(lines()[2]).toBe("Iodine Test at 62 °C for 10 min");
    expect(openGoals()).toEqual([2]);
  });

  it("ACC-046 marks an incomplete goal, and its entry in the problem list opens it", async () => {
    await withGoals([{ type: "MashIn" }, { type: "HeatUp" }]);
    expect(lines()).toEqual(["Mash In", "Heat Up to ? °C"]);
    expect(items()[0].querySelector("[data-incomplete]")).toBeNull();
    expect(items()[1].querySelector("[data-incomplete]")).not.toBeNull();
    await act(async () => button("Goal 2").click());
    expect(openGoals()).toEqual([1]);
    expect(document.activeElement).toBe(items()[1].querySelector("input"));
  });
});

describe("App, signed in: Discard changes (QE-25)", () => {
  const recipe = { version: 2, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } };

  /** A Google Drive holding Kept.json, and a browser that is still signed in (DRV-011). */
  async function signedIn() {
    const drive = new FakeDrive();
    drive.validTokens = new Set(["t1", "tok"]);
    const store = new DriveStore(new FakeAuth(), drive.fetch);
    await store.init();
    await store.create("Kept", recipe);
    const storage = new Map([[TOKEN_KEY, JSON.stringify({ token: "tok", expiresAt: Date.now() + 3_600_000 })]]);
    const auth = new GoogleAuth("test-client", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    } as unknown as Storage);
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = drive.fetch;
    const drafts = new MemoryStore();
    Object.defineProperty(drafts, "firstUse", { value: false });
    await act(async () => {
      render(<App openDrafts={async () => drafts} auth={auth} />, root);
    });
    for (let i = 0; i < 10 && !root.textContent?.includes("Saved in Google Drive"); i++) {
      await act(async () => new Promise((r) => setTimeout(r, 0)));
    }
    return { drive, restore: () => (globalThis.fetch = fetchBefore) };
  }

  const discard = () => button("Discard changes");
  const titleText = () => root.querySelector("[aria-label=Recipe] button[aria-label^='Edit recipe name']")?.textContent;

  async function rename(name: string) {
    await act(async () => root.querySelector<HTMLButtonElement>("[aria-label=Recipe] button[aria-label^='Edit recipe name']")!.click());
    const input = root.querySelector<HTMLInputElement>("[aria-label=Recipe] input[aria-label='Recipe name']")!;
    await act(async () => {
      input.value = name;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  }

  async function inDialog(label: string) {
    await act(async () => {
      [...root.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find((b) => b.textContent === label)!.click();
    });
    for (let i = 0; i < 5; i++) {
      await act(async () => new Promise((r) => setTimeout(r, 0)));
    }
  }

  it("ACC-056 tells where the recipes are in the recipe list, not in a notice at the top", async () => {
    const { restore } = await signedIn();
    try {
      expect(root.textContent).not.toContain("Cloud Sync is on");
      const sidebar = root.querySelector<HTMLElement>("#recipe-sidebar")!;
      const hint = sidebar.querySelector<HTMLElement>("[data-drive-hint]")!;
      expect(hint.textContent).toContain("Google Drive, folder BrewberryPi/recipes");
      const link = [...sidebar.querySelectorAll("button")].find((b) => b.textContent?.includes("Add untracked file"))!;
      expect(link.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      restore();
    }
  });

  it("ACC-045 discards unsaved changes after asking, and shows the version saved in Google Drive", async () => {
    const { drive, restore } = await signedIn();
    try {
      expect(root.textContent).toContain("Saved in Google Drive");
      expect(discard().disabled).toBe(true);

      await rename("Changed here");
      expect(root.textContent).toContain("Unsaved changes");
      expect(discard().disabled).toBe(false);

      await act(async () => discard().click());
      expect(root.querySelector("[role=dialog]")?.textContent).toContain("Discard your changes to Kept.json");
      await inDialog("Cancel");
      expect(titleText()).toContain("Changed here");

      await act(async () => discard().click());
      await inDialog("Discard changes");
      expect(titleText()).toContain("Kept recipe");
      expect(root.textContent).toContain("Saved in Google Drive");
      const file = drive.files.find((f) => f.name === "Kept.json")!;
      expect(JSON.parse(file.content).name).toBe("Kept recipe");
      expect(file.version).toBe(1); // not written
    } finally {
      restore();
    }
  });

  it("ACC-045 is disabled for a recipe not saved to Google Drive yet", async () => {
    const { restore } = await signedIn();
    try {
      await act(async () => button("New recipe").click());
      await nameAs("Fresh", "Create");
      expect(root.textContent).toContain("Not saved to Google Drive yet");
      expect(discard().disabled).toBe(true);
    } finally {
      restore();
    }
  });
});
