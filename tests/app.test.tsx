// @vitest-environment jsdom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { newDoc } from "../src/doc";
import { MemoryStore, type DraftStore } from "../src/store/BrowserStore";
import { GoogleAuth, TOKEN_KEY } from "../src/auth/google";
import { DriveStore } from "../src/store/DriveStore";
import { FakeAuth, FakeDrive } from "./fakeDrive";
import { BROWSER_STORAGE_WARNING, MEMORY_STORAGE_WARNING } from "../src/ui/Banners";
import { SIDEBAR_KEY } from "../src/ui/sidebar";
import { CHANGE_POLL_MS } from "../src/driveSync";
import { MASH_RESTS, MASH_REST_IDS, toRecipe, type MashRestId, type Recipe } from "../src/model";

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

/** Shows the app and opens the selected recipe's Mash Process tab (the Ingredients tab opens first, GUI-032). */
async function showMashProcess(drafts: DraftStore) {
  await show(drafts);
  await act(async () => root.querySelector<HTMLElement>("[aria-label=Recipe] #tab-mash")!.click());
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept", mashing_process: { goals: [] } }));
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
    await show(store);
    expect(root.querySelector("[aria-label=Recipes]")?.textContent).toContain("Kept recipe");
    expect(root.querySelector("[aria-label=Recipes]")?.textContent).toContain("not downloaded");
    expect(root.textContent).toContain("Complete: BrewberryPi can load this recipe.");
  });
});

describe("App, a recipe without goals (app Q-34)", () => {
  it("ACC-009 is valid and can be downloaded, with a note that the app can't brew it yet", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Draft", { version: 3, name: "Draft", mashing_process: { goals: [] } }));
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
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
  it("ACC-048 shows the tabs Malt, selected, Mashing, Boiling, Water and Mash Process with the goals; the problems are below them", async () => {
    const store = new MemoryStore();
    await store.put(newDoc("Kept", { version: 3, name: "Kept", mashing_process: { goals: [{ type: "HeatUp" }] } }));
    await show(store);
    const recipe = root.querySelector("[aria-label=Recipe]")!;
    const tabs = () => [...recipe.querySelectorAll<HTMLElement>("[role=tablist] [role=tab]")];
    expect(tabs().map((t) => [t.textContent, t.getAttribute("aria-selected")])).toEqual([
      ["Malt", "true"],
      ["Mashing", "false"],
      ["Boiling", "false"],
      ["Water", "false"],
      ["Mash Process", "false"],
    ]);
    expect(recipe.querySelector("[role=tabpanel] [data-ingredients=malts]")).not.toBeNull();
    await act(async () => tabs()[4].click());
    const panel = recipe.querySelector<HTMLElement>("[role=tabpanel]")!;
    expect(panel.getAttribute("aria-labelledby")).toBe(tabs()[4].id);
    expect(panel.querySelector("ol [data-goal-line]")).not.toBeNull();
    const addGoal = [...panel.querySelectorAll("button")].find((b) => b.textContent?.trim() === "+ Add goal")!;
    expect(addGoal.hasAttribute("data-add-row")).toBe(true);
    // The goal list's last row: right after the goals, inside the same frame.
    expect(panel.querySelector("ol")!.nextElementSibling!.contains(addGoal)).toBe(true);
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept", mashing_process: { goals } }));
    await showMashProcess(store);
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } }));
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept", mashing_process: { goals: [{ type: "HeatUp", temperature: 40 }] } }));
    await showMashProcess(store);
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept", mashing_process: { goals } }));
    await showMashProcess(store);
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
    await store.put(newDoc("Kept", { version: 3, name: "Kept", mashing_process: { goals } }));
    await showMashProcess(store);
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

describe("App, signed in: recipe names in the list (QE-31)", () => {
  const recipe = (name: string) => JSON.stringify({ version: 3, name, mashing_process: { goals: [{ type: "MashIn" }] } });

  async function until(check: () => boolean) {
    for (let i = 0; i < 50 && !check(); i++) {
      await act(async () => new Promise((r) => setTimeout(r, 0)));
    }
  }

  it("ACC-057 shows the names of recipes not opened, and follows their changes in Google Drive", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    const drive = new FakeDrive();
    drive.validTokens = new Set(["t1", "tok"]);
    const store = new DriveStore(new FakeAuth(), drive.fetch);
    await store.init();
    await store.create("Kept", JSON.parse(recipe("Kept recipe")));
    const other = await store.create("Other", JSON.parse(recipe("Other recipe")));
    const storage = new Map([[TOKEN_KEY, JSON.stringify({ token: "tok", expiresAt: Date.now() + 3_600_000 })]]);
    const auth = new GoogleAuth("test-client", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    } as unknown as Storage);
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = drive.fetch;
    try {
      const drafts = new MemoryStore();
      Object.defineProperty(drafts, "firstUse", { value: false });
      await act(async () => {
        render(<App openDrafts={async () => drafts} auth={auth} />, root);
      });
      const names = () => listText().join(" | ");
      await until(() => names().includes("Other recipe"));
      expect(names()).toContain("Kept recipe");
      expect(names()).toContain("Other recipe"); // not opened, but read

      const file = drive.files.find((f) => f.id === other.fileId)!;
      Object.assign(file, { content: recipe("Renamed in Drive"), version: file.version + 1 });
      drive.changed(file);
      drive.add({ name: "New.json", parents: [store.recipesFolderId], content: recipe("New from Drive") });
      await act(async () => {
        vi.advanceTimersByTime(CHANGE_POLL_MS); // the next check of the changes feed
      });
      await until(() => names().includes("Renamed in Drive") && names().includes("New from Drive"));
      expect(names()).toContain("Renamed in Drive");
      expect(names()).toContain("New from Drive");
      expect(names()).not.toContain("Other recipe");
    } finally {
      globalThis.fetch = fetchBefore;
      vi.useRealTimers();
      if (visibility) {
        delete (document as unknown as Record<string, unknown>).visibilityState;
      }
    }
  });
});

describe("App, signed in: Discard changes (QE-25)", () => {
  const recipe = { version: 3, name: "Kept recipe", mashing_process: { goals: [{ type: "MashIn" }] } };

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

describe("App, the Mashing tab (QE-32)", () => {
  const recipe = () => root.querySelector("[aria-label=Recipe]")!;
  const panel = () => recipe().querySelector<HTMLElement>("[role=tabpanel]")!;
  const row = (id: string) => panel().querySelector<HTMLElement>(`[data-mash-rest=${id}]`)!;
  const field = (id: string, label: string) =>
    [...row(id).querySelectorAll("label")].find((l) => l.textContent?.startsWith(label))!.querySelector("input")!;
  async function openMashing(content: Recipe = { version: 3, name: "Plan", mashing_process: { goals: [{ type: "MashIn" }] } }) {
    const store = new MemoryStore();
    await store.put(newDoc("Plan", content));
    await show(store);
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mashing")!.click());
  }
  async function tick(id: string) {
    await act(async () => row(id).querySelector<HTMLInputElement>("input[type=checkbox]")!.click());
  }
  async function type(input: HTMLInputElement, value: string) {
    await act(async () => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  /** Downloads the recipe from its menu and returns the file's text. */
  async function download(): Promise<string> {
    let blob: Blob | undefined;
    Object.assign(URL, { createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL: () => undefined });
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    await menu("Plan", "Download");
    HTMLAnchorElement.prototype.click = click;
    if (!blob) {
      throw new Error("not downloaded");
    }
    const file = blob;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });
  }

  it("ACC-058 lists the 9 rests as table rows with the typical values in the °C and min columns, and expands what each does", async () => {
    await openMashing();
    expect(recipe().querySelector("#tab-mashing")!.getAttribute("aria-selected")).toBe("true");
    const rows = [...panel().querySelectorAll<HTMLElement>("[data-mash-rest]")];
    expect(rows.map((r) => r.dataset.mashRest)).toEqual([...MASH_REST_IDS]);
    const table = panel().querySelector("table")!;
    const heading = document.getElementById(table.getAttribute("aria-labelledby")!)!;
    expect([heading.tagName, heading.textContent?.trim()]).toEqual(["H3", "Rests"]);
    expect(heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const r of rows) {
      const info = MASH_RESTS[r.dataset.mashRest as MashRestId];
      expect(r.textContent).toContain(info.label);
      const typical = (f: string) => r.querySelector(`[data-mash-typical=${f}]`)!;
      expect([typical("temperature").textContent, typical("minutes").textContent]).toEqual([
        `${info.tempMin}–${info.tempMax} °C`,
        info.duration,
      ]);
      expect(typical("temperature").closest("td")!.cellIndex).toBe(3); // Typical, after °C
      expect(typical("minutes").closest("td")!.cellIndex).toBe(5); // Typical, after min
      expect(r.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked).toBe(false);
      expect(r.querySelector("input:not([type=checkbox])")).toBeNull();
      const about = r.querySelector<HTMLButtonElement>("button[aria-expanded]")!;
      expect([about.title, about.getAttribute("aria-expanded")]).toEqual(["About this rest", "false"]);
      await act(async () => about.click());
      expect(about.getAttribute("aria-expanded")).toBe("true");
      const texts = panel().querySelector(`[data-mash-about=${r.dataset.mashRest}]`)!;
      expect(texts.id).toBe(about.getAttribute("aria-controls"));
      for (const [term, text] of info.about) {
        expect(texts.textContent).toContain(`${term}: ${text}`);
      }
    }
    expect(panel().querySelectorAll("[data-mash-about]")).toHaveLength(1); // one open at a time
    await act(async () => row("MashOut").querySelector<HTMLButtonElement>("button[aria-expanded]")!.click());
    expect(panel().querySelector("[data-mash-about]")).toBeNull();
    expect(rows[5].textContent).toContain("Maltose rest (beta-amylase rest)");
    expect(rows[5].textContent).toContain("60–65 °C");
    const heads = [...panel().querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads).toEqual(["Planned", "Rest", "°C", "Typical", "min", "Typical", "About"]);
    // A ticked rest: its fields in the °C and min columns, the typical values stay in their own columns.
    await tick("MaltoseRest");
    for (const [f, cell] of [["temperature", 3], ["minutes", 5]] as const) {
      const t = row("MaltoseRest").querySelector(`[data-mash-typical=${f}]`)!;
      expect(t.closest("td")!.cellIndex).toBe(cell);
      expect((row("MaltoseRest") as HTMLTableRowElement).cells[cell - 1].querySelector("input")).not.toBeNull();
    }
    expect(panel().querySelector("[data-goal-line]")).toBeNull();
  });

  it("ACC-059 ticking plans a rest with its presets, its fields change it, unticking removes it", async () => {
    await openMashing();
    await tick("MashOut");
    await tick("MaltoseRest");
    expect([field("MaltoseRest", "Temperature").value, field("MaltoseRest", "Duration").value]).toEqual(["63", "45"]);
    expect([field("MashOut", "Temperature").value, field("MashOut", "Duration").value]).toEqual(["78", "10"]);
    expect(recipe().textContent).toContain("Complete: BrewberryPi can load this recipe.");
    await type(field("MaltoseRest", "Duration"), "50");
    const text = await download();
    expect(text).toContain(
      '  },\n  "mashing": {\n    "MaltoseRest": { "temperature": 63, "minutes": 50 },\n    "MashOut": { "temperature": 78, "minutes": 10 }\n  }\n}\n',
    );
    await tick("MaltoseRest");
    await tick("MashOut");
    expect(row("MaltoseRest").querySelector("input:not([type=checkbox])")).toBeNull();
    expect(await download()).not.toContain("mashing\"");
    await tick("PreMash");
    expect([field("PreMash", "Temperature").value, field("PreMash", "Duration").value]).toEqual(["25", "20"]);
  });

  it("ACC-060 warns outside the typical range, and the recipe stays complete", async () => {
    await openMashing();
    await tick("MaltoseRest");
    const warning = () => row("MaltoseRest").querySelector("[data-mash-warning]")?.textContent;
    const typicalOf = () => row("MaltoseRest").querySelector("[data-mash-typical=temperature]")!;
    expect(warning()).toBeUndefined();
    await type(field("MaltoseRest", "Temperature"), "70");
    expect(warning()).toBe("⚠ Outside the typical range");
    expect(typicalOf().nextElementSibling!.matches("[data-mash-warning]")).toBe(true); // right after the range
    const input = field("MaltoseRest", "Temperature");
    expect(input.className).toContain("ring-amber-500!");
    const typical = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(typical).toBe(typicalOf());
    expect(typical.textContent).toBe("60–65 °C");
    expect(typical.className).toContain("text-amber-700");
    expect(recipe().textContent).toContain("Complete: BrewberryPi can load this recipe.");
    expect(await download()).toContain('"MaltoseRest": { "temperature": 70, "minutes": 45 }');
    await type(field("MaltoseRest", "Temperature"), "60");
    expect(warning()).toBeUndefined();
    await type(field("MaltoseRest", "Temperature"), "65");
    expect(warning()).toBeUndefined();
  });

  it("ACC-061 reports a rest's problem, marks its field, and the problem opens the Mashing tab", async () => {
    await openMashing();
    await tick("MaltoseRest");
    await type(field("MaltoseRest", "Temperature"), "");
    expect(recipe().textContent).toContain("Mashing, Maltose rest: The Maltose rest needs a temperature.");
    expect(field("MaltoseRest", "Temperature").className).toContain("ring-red-400");
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mash")!.click());
    expect(panel().querySelector("[data-mash-rest]")).toBeNull();
    await act(async () => button("Mashing, Maltose rest").click());
    expect(recipe().querySelector("#tab-mashing")!.getAttribute("aria-selected")).toBe("true");
    expect(row("MaltoseRest")).not.toBeNull();
  });

  const ladder = () => panel().querySelector<HTMLElement>("[data-mash-ladder]")!;
  const total = () => ladder().querySelector("[data-mash-total]")!.textContent;
  const scheduleWarningsShown = () =>
    [...ladder().querySelectorAll("[data-mash-schedule-warnings] li")].map((li) => li.textContent);
  async function plan(steps: [string, string, string][]) {
    for (const [id, temperature, minutes] of steps) {
      await tick(id);
      await type(field(id, "Temperature"), temperature);
      await type(field(id, "Duration"), minutes);
    }
  }

  it("ACC-065 shows the ladder above the table: every rest labelled by typical temperature, the 78 °C limit", async () => {
    await openMashing();
    const l = ladder();
    expect(l.compareDocumentPosition(panel().querySelector("table")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const heading = panel().querySelector("#mash-ladder-title")!;
    expect([heading.tagName, heading.textContent?.trim()]).toEqual(["H3", "Temperature Ladder"]);
    expect(heading.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const rests = [...l.querySelectorAll<SVGGElement>("[data-ladder-rest]")];
    expect(rests.map((g) => g.dataset.ladderRest)).toEqual([
      "PreMash",
      "AcidRest",
      "BetaGlucanRest",
      "FerulicAcidRest",
      "ProteinRest",
      "MaltoseRest",
      "CombinedRest",
      "SaccharificationRest",
      "MashOut",
    ]);
    for (const g of rests) {
      const info = MASH_RESTS[g.dataset.ladderRest as MashRestId];
      expect(g.textContent).toContain(`${info.short}`);
      expect(g.textContent).toContain(`${info.tempTypical} °C`);
      expect(g.querySelectorAll("text")).toHaveLength(1); // name and typical temperature only
      expect(g.querySelector("title")!.textContent).toContain(`Enzyme`);
    }
    expect(l.querySelector("[data-ladder-rest=AcidRest]")!.textContent).toContain("(obsolete)");
    expect(l.querySelector("[data-ladder-limit]")!.textContent).toBe("max 78 °C");
    expect(total()).toBe("No rests planned yet.");
    expect(l.textContent).toContain("Tick rests below to draw the schedule.");
    expect(l.querySelector("[data-ladder-profile]")).toBeNull();
  });

  it("ACC-065 clicking a rest in the ladder opens what it does in the table", async () => {
    await openMashing();
    await act(async () => {
      ladder().querySelector<SVGGElement>("[data-ladder-rest=ProteinRest]")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(panel().querySelector("[data-mash-about=ProteinRest]")).not.toBeNull();
    expect(row("ProteinRest").querySelector("button[aria-expanded]")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("ACC-065 a planned rest's label and tick show its planned temperature", async () => {
    await openMashing();
    const preMash = () => ladder().querySelector<SVGGElement>("[data-ladder-rest=PreMash]")!;
    expect(preMash().querySelector("text")!.textContent).toBe("Pre-mash 25 °C");
    await plan([["PreMash", "30", "20"]]);
    expect(preMash().querySelector("text")!.textContent).toBe("Pre-mash 30 °C");
    expect(preMash().querySelector("title")!.textContent).toContain("Planned: 30 °C for 20 min");
    // The tick sits where the profile holds 30 °C.
    const hold = ladder().querySelector("[data-ladder-profile] line[stroke=transparent]")!;
    expect(preMash().querySelector("[data-ladder-tick]")!.getAttribute("y1")).toBe(hold.getAttribute("y1"));
    await tick("PreMash");
    expect(preMash().querySelector("text")!.textContent).toBe("Pre-mash 25 °C");
    expect(preMash().querySelector("title")!.textContent).not.toContain("Planned");
  });

  it("ACC-066 draws the planned schedule with its total time; the heating rate changes the ramps", async () => {
    await openMashing();
    await plan([
      ["PreMash", "35", "15"],
      ["MaltoseRest", "63", "45"],
      ["SaccharificationRest", "72", "30"],
      ["MashOut", "78", "5"],
    ]);
    expect(total()).toBe("Total mash time 2 h 18 min: 1 h 35 min of rests, 43 min heating at 1 °C/min.");
    expect(ladder().querySelectorAll("[data-ladder-profile] polyline")).toHaveLength(1);
    expect(ladder().querySelector("[data-ladder-profile] polyline")!.getAttribute("points")!.split(" ")).toHaveLength(8);
    expect(scheduleWarningsShown()).toEqual([]);
    const rate = [...ladder().querySelectorAll("label")].find((l) => l.textContent?.startsWith("Heating rate"))!.querySelector("input")!;
    await type(rate, "2");
    expect(total()).toBe("Total mash time 1 h 57 min: 1 h 35 min of rests, 22 min heating at 2 °C/min.");
  });

  it("ACC-064 shows the schedule's warnings, and the recipe stays complete", async () => {
    await openMashing();
    await plan([
      ["MaltoseRest", "66", "90"],
      ["MashOut", "80", "5"],
    ]);
    expect(scheduleWarningsShown()).toEqual([
      "⚠ Maltose rest for 90 min is outside its typical duration (30–60 min).",
      "⚠ Mash-out at 80 °C is above 78 °C: α-amylase is destroyed and unconverted starch stays in the wort.",
      "⚠ No Combined rest or Saccharification rest: the starch may not be converted completely.",
    ]);
    expect(recipe().textContent).toContain("Complete: BrewberryPi can load this recipe.");
  });

  it("ACC-061 keeps and reports an unknown rest of an opened file", async () => {
    await openMashing({ version: 3, name: "Plan", mashing_process: { goals: [] }, mashing: { MainRest: { temperature: 63, minutes: 45 } } });
    expect(recipe().textContent).toContain('Mashing, MainRest: Unknown rest "MainRest".');
    await tick("MashOut");
    expect(recipe().textContent).toContain('Unknown rest "MainRest".');
  });
});

describe("App, the Malt and Hops tabs (QE-34, QE-35)", () => {
  const recipe = () => root.querySelector("[aria-label=Recipe]")!;
  const section = (kind: string) => recipe().querySelector<HTMLElement>(`[data-ingredients=${kind}]`)!;
  /** The rows of a kind: malts and hops each in their tab's table, other additions below the hops (EDT-060). */
  const rows = (kind: string) => [...recipe().querySelectorAll<HTMLTableRowElement>(`tbody tr[data-ingredient-kind=${kind}]`)];
  const nameField = (kind: string, i: number) => rows(kind)[i].querySelector<HTMLInputElement>("[data-ingredient-name] input")!;
  const field = (kind: string, i: number, f: string) =>
    rows(kind)[i].querySelector<HTMLInputElement>(`[data-ingredient-field=${f}] input`)!;
  const shares = (kind: string) => rows(kind).map((r) => r.querySelector("[data-ingredient-share]")!.textContent);
  /** The Total line: its label, total weight and share. */
  const total = (kind: string) => {
    const tds = [...section(kind).querySelectorAll("[data-ingredient-total] td")].map((td) => td.textContent);
    return [tds[1], tds[tds.length - 3], tds[tds.length - 2]]; // the grams just before the share
  };
  const figure = () => recipe().querySelector("[data-figure] [data-figure-value]")!.textContent;
  const hint = () => recipe().querySelector("[data-figure-hint]")!.textContent;
  const batchField = (label: string) =>
    [...recipe().querySelectorAll<HTMLLabelElement>("[data-batch-fields] label")].find((l) => l.textContent?.startsWith(label))!.querySelector("input")!;
  async function open(content: Recipe = { version: 3, name: "Brew", mashing_process: { goals: [{ type: "MashIn" }] } }) {
    const store = new MemoryStore();
    await store.put(newDoc("Brew", content));
    await show(store);
  }
  async function showTab(kind: "malts" | "hops" | "water") {
    await act(async () => recipe().querySelector<HTMLElement>(`#tab-${kind}`)!.click());
  }
  /** Enters a field of the Water tab (the knockout volume, the gravities; EDT-050) and goes back to `back`. */
  async function setOnWater(field: string, value: string, back: "malts" | "hops") {
    await showTab("water");
    const label = [...recipe().querySelectorAll("[role=tabpanel] label")].find((l) => l.textContent?.startsWith(field))!;
    await type(label.querySelector("input")!, value);
    await showTab(back);
  }
  const setKnockout = (value: string, back: "malts" | "hops") => setOnWater("Knockout volume", value, back);
  async function type(input: HTMLInputElement, value: string) {
    await act(async () => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  /** Adds a row on the open tab: its name, grams and the other fields in table order. */
  async function add(kind: "malts" | "hops", name: string, grams: string, more: Record<string, string> = {}) {
    await act(async () => button(kind === "malts" ? "+ Add malt" : "+ Add hop").click());
    const i = rows(kind).length - 1;
    await type(nameField(kind, i), name);
    await type(field(kind, i, "grams"), grams);
    for (const [f, v] of Object.entries(more)) {
      await type(field(kind, i, f), v);
    }
  }
  async function download(): Promise<string> {
    let blob: Blob | undefined;
    Object.assign(URL, { createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL: () => undefined });
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    await menu("Brew", "Download");
    HTMLAnchorElement.prototype.click = click;
    if (!blob) {
      throw new Error("not downloaded");
    }
    const file = blob;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });
  }

  it("ACC-067 the Malt and Hops tabs each have a table; rows are added and removed, and an empty list leaves the file", async () => {
    await open();
    const heads = (kind: string) => [...section(kind).querySelectorAll("thead th")].map((th) => th.textContent);
    expect(heads("malts")).toEqual(["Move", "Name", "EBC", "Absolute amount (g)", "Relative amount (%)", "Remove"]);
    expect(section("hops")).toBeNull(); // on its own tab
    expect(section("malts").textContent).toContain("No malt yet.");
    expect(total("malts")[0]).toBe("Total");
    // The add row is part of the table: after the entries, before the Total line.
    expect(section("malts").querySelector("tbody tr:last-child [data-add-row]")!.textContent).toBe("+ Add malt");
    await act(async () => button("+ Add malt").click());
    expect(rows("malts")).toHaveLength(1);
    expect(document.activeElement).toBe(nameField("malts", 0));
    expect(rows("malts")[0].nextElementSibling!.querySelector("[data-add-row]")).not.toBeNull();
    await type(nameField("malts", 0), "Pilsner malt");
    await type(field("malts", 0, "grams"), "4500");
    expect(await download()).toContain('"ingredients"');
    await act(async () => rows("malts")[0].querySelector<HTMLButtonElement>("button[aria-label='Remove malt 1']")!.click());
    expect(rows("malts")).toHaveLength(0);
    expect(await download()).not.toContain("ingredients");
    await showTab("hops");
    expect(heads("hops")).toEqual(["Move", "Name", "α %", "Cooking time (min)", "Absolute amount (g)", "Relative amount (%)", "Remove"]);
    expect(section("hops").textContent).toContain("No hop yet.");
    expect(section("hops").querySelector("tbody tr:last-child [data-add-row]")!.textContent).toBe("+ Add hop");
  });

  it("ACC-068 shows each row's share of the table's total weight and the total", async () => {
    await open();
    await add("malts", "Pilsner malt", "4500");
    await add("malts", "Munich malt", "500");
    expect(shares("malts")).toEqual(["90 %", "10 %"]);
    expect(total("malts")).toEqual(["Total", "5000 g", "100 %"]);
    await showTab("hops");
    for (const name of ["Hallertauer", "Saaz", "Tettnanger"]) {
      await add("hops", name, "10");
    }
    expect(shares("hops")).toEqual(["33.3 %", "33.3 %", "33.3 %"]);
    expect(total("hops")).toEqual(["Total hops", "30 g", "100 %"]);
    await type(field("hops", 2, "grams"), "");
    expect(shares("hops")).toEqual(["50 %", "50 %", "–"]);
    expect(total("hops")).toEqual(["Total hops", "20 g", "100 %"]);
  });

  it("ACC-069 reports a row without a name or a whole amount, marks its fields, and the problem opens its tab", async () => {
    await open();
    await act(async () => button("+ Add malt").click());
    expect(recipe().textContent).toContain("Malt 1: Malt 1 needs a name.");
    expect(recipe().textContent).toContain("Malt 1: Malt 1 needs an amount in grams.");
    expect(nameField("malts", 0).className).toContain("ring-red-400");
    expect(field("malts", 0, "grams").className).toContain("ring-red-400");
    await type(nameField("malts", 0), "Pilsner malt");
    await type(field("malts", 0, "grams"), "12.5");
    expect(recipe().textContent).toContain("Malt 1: the amount must be a whole number of grams.");
    await type(field("malts", 0, "grams"), "0");
    expect(recipe().textContent).toContain("Malt 1: the amount must be at least 1 g.");
    await showTab("hops");
    await act(async () => button("+ Add hop").click());
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mash")!.click());
    expect(recipe().querySelector("[data-ingredients]")).toBeNull();
    await act(async () => button("Malt 1").click());
    expect(recipe().querySelector("#tab-malts")!.getAttribute("aria-selected")).toBe("true");
    await act(async () => button("Hop 1").click());
    expect(recipe().querySelector("#tab-hops")!.getAttribute("aria-selected")).toBe("true");
    await act(async () => rows("hops")[0].querySelector<HTMLButtonElement>("button[aria-label='Remove hop 1']")!.click());
    await showTab("malts");
    await type(field("malts", 0, "grams"), "4500");
    expect(recipe().textContent).toContain("Complete: BrewberryPi can load this recipe.");
  });

  it("ACC-070 writes the ingredients one entry per line, malts before hops, then the batch, without computed values", async () => {
    await open({
      version: 3,
      name: "Brew",
      mashing_process: { goals: [{ type: "MashIn" }] },
      mashing: { MashOut: { temperature: 78, minutes: 10 } },
    });
    await showTab("hops");
    await add("hops", "Hallertauer Tradition", "30", { alpha: "5.5", minutes: "60" });
    await setOnWater("Original gravity", "12.6", "malts");
    await add("malts", "Pilsner malt", "4500", { ebc: "3.5" });
    await add("malts", "Munich malt", "500");
    await setKnockout("20", "malts");
    const text = await download();
    expect(text).toContain(
      '  "mashing": {\n    "MashOut": { "temperature": 78, "minutes": 10 }\n  },\n' +
        '  "ingredients": {\n' +
        '    "malts": [\n' +
        '      { "name": "Pilsner malt", "grams": 4500, "ebc": 3.5 },\n' +
        '      { "name": "Munich malt", "grams": 500 }\n' +
        "    ],\n" +
        '    "hops": [\n' +
        '      { "name": "Hallertauer Tradition", "grams": 30, "alpha": 5.5, "minutes": 60 }\n' +
        "    ]\n" +
        "  },\n" +
        '  "batch": { "liters": 20, "plato": 12.6 }\n}\n', // liters first, though the gravity was entered first
    );
    expect(text).not.toMatch(/%|EBC"|IBU|share/);
    const read = toRecipe(JSON.parse(text));
    expect([read.ingredients, read.batch]).toEqual([
      {
        malts: [
          { name: "Pilsner malt", grams: 4500, ebc: 3.5 },
          { name: "Munich malt", grams: 500 },
        ],
        hops: [{ name: "Hallertauer Tradition", grams: 30, alpha: 5.5, minutes: 60 }],
      },
      { liters: 20, plato: 12.6 },
    ]);
  });

  it("ACC-071 reorders malts and hops by dragging the handle or with the arrow keys on it", async () => {
    await open();
    for (const [name, grams] of [["Pilsner malt", "4500"], ["Munich malt", "500"], ["Caramunich", "200"]]) {
      await add("malts", name, grams);
    }
    const names = () => rows("malts").map((_, i) => nameField("malts", i).value);
    const handles = () => rows("malts").map((r) => r.querySelector<HTMLButtonElement>("[data-drag-handle]")!);
    expect(handles()[0].getAttribute("aria-label")).toBe("Move malt 1");
    // jsdom has no layout: row i spans y = 100·i … 100·i + 80.
    rows("malts").forEach((tr, i) => {
      tr.getBoundingClientRect = () => ({ top: i * 100, height: 80, bottom: i * 100 + 80, left: 0, right: 100, width: 100, x: 0, y: i * 100, toJSON: () => ({}) });
    });
    const pointer = (target: Element, type: string, clientY: number) => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientY, button: 0 }));
    };
    const handle = handles()[0];
    await act(async () => pointer(handle, "pointerdown", 40));
    await act(async () => pointer(handle, "pointermove", 270));
    expect(section("malts").querySelectorAll("[data-drop-line]")).toHaveLength(1);
    await act(async () => pointer(handle, "pointerup", 270));
    expect(names()).toEqual(["Munich malt", "Caramunich", "Pilsner malt"]);
    expect(section("malts").querySelectorAll("[data-drop-line]")).toHaveLength(0);
    expect(shares("malts")).toEqual(["9.6 %", "3.8 %", "86.5 %"]); // the shares move with their rows (total 5200 g)
    handles()[2].focus();
    await act(async () => {
      handles()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    });
    expect(names()).toEqual(["Munich malt", "Pilsner malt", "Caramunich"]);
    expect(document.activeElement).toBe(handles()[1]);
    expect(await download()).toContain(
      '      { "name": "Munich malt", "grams": 500 },\n      { "name": "Pilsner malt", "grams": 4500 },\n      { "name": "Caramunich", "grams": 200 }\n',
    );
  });

  it("ACC-072 draws a donut of the shares, one slice per row with an amount, in the rows' colours, with a legend", async () => {
    await open();
    expect(recipe().querySelector("[data-share-chart]")).toBeNull();
    await add("malts", "Pilsner malt", "4500");
    await add("malts", "Munich malt", "500");
    await add("malts", "Caramunich", "");
    const chart = recipe().querySelector("[data-share-chart=malts]")!;
    const slices = [...chart.querySelectorAll("[data-share-slice]")];
    expect(slices.map((c) => c.getAttribute("stroke"))).toEqual(["var(--series-1)", "var(--series-2)"]);
    expect(slices.map((c) => c.querySelector("title")!.textContent)).toEqual(["Pilsner malt: 4500 g, 90 %", "Munich malt: 500 g, 10 %"]);
    expect([...chart.querySelectorAll("[data-share-legend] li")].map((li) => li.textContent)).toEqual(["Pilsner malt90 %", "Munich malt10 %"]);
    expect(chart.querySelector("text")!.textContent).toBe("5000 g");
    // The row's swatch has its slice's colour.
    expect(rows("malts")[1].querySelector<HTMLElement>("[data-ingredient-share] [aria-hidden]")!.style.background).toBe("var(--series-2)");
    // From the 9th row on, the slices share "other".
    for (let n = 3; n <= 9; n++) {
      await type(field("malts", rows("malts").length - 1, "grams"), "100");
      if (n < 9) {
        await add("malts", `Malt ${n + 1}`, "");
      }
    }
    expect([...chart.querySelectorAll("[data-share-slice]")].at(-1)!.getAttribute("stroke")).toBe("var(--series-other)");
  });

  it("ACC-073 shows the beer colour from the malts' EBC and the Water tab's knockout volume, or what is missing", async () => {
    await open();
    expect([figure(), hint()]).toEqual(["–", "Add malts with their amounts."]);
    await add("malts", "Pilsner malt", "4500", { ebc: "3.5" });
    await add("malts", "Munich malt", "500");
    expect([figure(), hint()]).toEqual(["–", "Enter the EBC of malt 2 and the knockout volume on the Water tab."]);
    expect(recipe().querySelector("[data-batch-fields]")).toBeNull(); // the volume is entered on the Water tab
    await type(field("malts", 1, "ebc"), "15");
    expect(hint()).toBe("Enter the knockout volume on the Water tab.");
    await act(async () => recipe().querySelector<HTMLButtonElement>("[data-figure-hint] [data-water-link]")!.click());
    expect(recipe().querySelector("#tab-water")!.getAttribute("aria-selected")).toBe("true");
    await setKnockout("20", "malts");
    expect(figure()).toBe("9 EBC");
    expect(recipe().querySelector<HTMLElement>("[data-beer-swatch]")!.style.background).toBe("rgb(255, 191, 66)");
    expect(hint()).toBe("Morey's formula, from each malt's EBC and the knockout volume (20 L, Water tab).");
    await type(field("malts", 1, "ebc"), "-1");
    expect(recipe().textContent).toContain("Malt 2: the colour must be a number of at least 0 EBC.");
  });

  it("ACC-074 shows the bitterness from the hops' alpha acid and boil time, the knockout volume and gravity", async () => {
    await open();
    await showTab("hops");
    expect([figure(), hint()]).toEqual(["–", "Add hops with their amounts."]);
    await add("hops", "Hallertauer Tradition", "30", { alpha: "5.5" });
    expect(hint()).toBe(
      "Enter the alpha acid and boil time of hop 1 and the knockout volume and the original gravity on the Water tab.",
    );
    await type(field("hops", 0, "minutes"), "60");
    await setKnockout("20", "hops");
    await setOnWater("Original gravity", "12.6", "hops");
    expect(figure()).toBe("19 IBU");
    expect(hint()).toBe(
      "Tinseth's formula, from each hop's alpha acid and boil time, the knockout volume (20 L, Water tab) and the original gravity (12.6 °P, Water tab).",
    );
    await add("hops", "Saaz", "20", { alpha: "4", minutes: "0" });
    expect(figure()).toBe("19 IBU"); // no boil, no bitterness
    await type(field("hops", 0, "alpha"), "101");
    expect(recipe().textContent).toContain("Hop 1: the alpha acid must be a number from 0 to 100 %.");
    await type(field("hops", 1, "minutes"), "2.5");
    expect(recipe().textContent).toContain("Hop 2: the boil time must be a whole number of minutes, at least 0.");
  });

  it("ACC-075 the knockout volume and the gravity come from the Water tab; an empty batch leaves the file", async () => {
    await open();
    expect(recipe().querySelector("[role=tabpanel] [data-figure] input")).toBeNull();
    await showTab("hops");
    expect(recipe().querySelector("[role=tabpanel] [data-figure] input")).toBeNull(); // no batch fields on Malt or Hops
    await setOnWater("Original gravity", "12.6", "hops");
    await setKnockout("20", "hops");
    expect(await download()).toContain('"batch": { "liters": 20, "plato": 12.6 }');
    await setKnockout("0", "hops");
    expect(recipe().textContent).toContain("Knockout volume: The knockout volume must be a number above 0 litres.");
    await setOnWater("Original gravity", "41", "hops");
    expect(recipe().textContent).toContain("Original gravity: The original gravity must be a number from 0 to 40 °P.");
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mash")!.click());
    await act(async () => button("Original gravity").click());
    expect(recipe().querySelector("#tab-water")!.getAttribute("aria-selected")).toBe("true");
    await showTab("hops");
    await act(async () => button("Knockout volume").click());
    expect(recipe().querySelector("#tab-water")!.getAttribute("aria-selected")).toBe("true");
    await setKnockout("", "hops");
    await setOnWater("Original gravity", "", "hops");
    expect(await download()).not.toContain("batch");
  });

  it("ACC-080 places the beer colour on a scale of common beers, with the styles whose range holds it", async () => {
    await open();
    await add("malts", "Pilsner malt", "4500", { ebc: "3.5" });
    await add("malts", "Munich malt", "500", { ebc: "15" });
    expect(recipe().querySelector("[data-style-scale=colour]")).toBeNull(); // no colour yet
    await setKnockout("20", "malts");
    const scale = recipe().querySelector("[data-style-scale=colour]")!;
    expect([...scale.querySelectorAll("[data-scale-style]")].map((g) => g.textContent)).toEqual(["Pils", "Pale Ale", "Märzen", "Dunkel", "Stout"]);
    expect(scale.querySelector("svg")!.getAttribute("aria-label")).toBe("9 EBC on a scale from 0 to 80 EBC, like Helles, Weissbier");
    expect(scale.querySelector("[data-scale-styles]")!.textContent).toBe("In the range of: Helles, Weissbier.");
    const markerX = () => Number(recipe().querySelector("[data-style-scale=colour] [data-scale-marker] line")!.getAttribute("x1"));
    const at9 = markerX();
    // Pils (6) left of the marker, Pale Ale (15) right of it.
    const styleX = (name: string) => Number(scale.querySelector(`[data-scale-style="${name}"] line`)!.getAttribute("x1"));
    expect(styleX("Pils")).toBeLessThan(at9);
    expect(styleX("Pale Ale")).toBeGreaterThan(at9);
    // A black beer sits at the end of the scale.
    await add("malts", "Roasted barley", "800", { ebc: "1300" });
    expect(recipe().querySelector("[data-style-scale=colour] [data-scale-styles]")!.textContent).toBe("Darker than a typical stout.");
    expect(markerX()).toBe(640 - 10);
  });

  it("ACC-082 places the bitterness on a scale of common beers, with BU:GU", async () => {
    await open();
    await showTab("hops");
    await add("hops", "Hallertauer Tradition", "30", { alpha: "5.5", minutes: "60" });
    await setKnockout("20", "hops");
    // Without the original gravity there is no bitterness yet, so no scale and no BU:GU.
    expect(recipe().querySelector("[data-style-scale=bitterness]")).toBeNull();
    expect(recipe().querySelector("[data-bu-gu]")).toBeNull();
    await setOnWater("Original gravity", "12.6", "hops");
    const scale = recipe().querySelector("[data-style-scale=bitterness]")!;
    expect([...scale.querySelectorAll("[data-scale-style]")].map((g) => g.textContent)).toEqual(["Weissbier", "Helles", "Pils", "Pale Ale", "IPA"]);
    expect(scale.querySelector("[data-scale-styles]")!.textContent).toBe("In the range of: Helles, Märzen, Dunkel.");
    expect(recipe().querySelector("[data-bu-gu]")!.textContent).toBe("BU:GU 0.37: balanced (bitterness against the original gravity).");
    await type(field("hops", 0, "grams"), "200");
    expect(figure()).toBe("126 IBU");
    expect(recipe().querySelector("[data-style-scale=bitterness] [data-scale-styles]")!.textContent).toBe("More bitter than a typical IPA.");
    expect(recipe().querySelector("[data-bu-gu]")!.textContent).toContain("very bitter");
  });

  it("ACC-084 shows BU:GU on a bar of its bands with a marker; the current band is highlighted", async () => {
    await open();
    await showTab("hops");
    await add("hops", "Hallertauer Tradition", "30", { alpha: "5.5", minutes: "60" });
    await setKnockout("20", "hops");
    expect(recipe().querySelector("[data-balance-scale]")).toBeNull(); // no gravity, no BU:GU
    await setOnWater("Original gravity", "12.6", "hops");
    const scale = () => recipe().querySelector("[data-balance-scale]")!;
    const bands = () => [...scale().querySelectorAll<SVGGElement>("[data-balance-band]")];
    expect(bands().map((g) => g.dataset.balanceBand)).toEqual(["malty", "balanced", "bitter", "very bitter"]);
    expect([...scale().querySelectorAll("svg > text")].map((t) => t.textContent)).toEqual(["0", "0.35", "0.55", "0.80", "1.0+"]);
    const current = () => bands().filter((g) => g.querySelector("text")!.getAttribute("class")!.includes("font-semibold")).map((g) => g.dataset.balanceBand);
    expect(current()).toEqual(["balanced"]);
    const markerX = () => Number(scale().querySelector("[data-balance-marker] line")!.getAttribute("x1"));
    // 0.37 lies in the balanced band, near its malty edge.
    const band = (name: string) => scale().querySelector(`[data-balance-band="${name}"] rect`)!;
    const start = Number(band("balanced").getAttribute("x"));
    expect(markerX()).toBeGreaterThan(start);
    expect(markerX()).toBeLessThan(start + Number(band("balanced").getAttribute("width")) / 2);
    expect(scale().querySelector("svg")!.getAttribute("aria-label")).toBe("BU:GU 0.37, balanced, on a scale from malty to very bitter");
    await type(field("hops", 0, "grams"), "200");
    expect(current()).toEqual(["very bitter"]);
    expect(markerX()).toBe(640 - 10); // above 1.0: at the end
  });

  it("ACC-085 other additions: below the hops, no alpha, not in the shares or the bitterness, but in the schedule", async () => {
    await open();
    await showTab("hops");
    expect(recipe().querySelector("#tab-hops")!.textContent).toBe("Boiling");
    await add("hops", "Hallertauer Tradition", "30", { alpha: "5.5", minutes: "60" });
    await setKnockout("20", "hops");
    await setOnWater("Original gravity", "12.6", "hops");
    expect(figure()).toBe("19 IBU");
    // The group: its label, then its rows and its add row, below the hops' add row.
    const label = section("hops").querySelector("[data-group-label=others]")!;
    expect(label.textContent).toBe("Other additions — not in the shares or the bitterness");
    await act(async () => button("+ Add other addition").click());
    expect(rows("others")).toHaveLength(1);
    expect(document.activeElement).toBe(rows("others")[0].querySelector("[data-ingredient-name] input"));
    const other = rows("others")[0];
    expect(other.querySelector("[data-ingredient-field=alpha]")).toBeNull(); // no alpha acid
    await type(other.querySelector<HTMLInputElement>("[data-ingredient-name] input")!, "Irish Moss");
    await type(other.querySelector<HTMLInputElement>("[data-ingredient-field=grams] input")!, "10");
    await type(other.querySelector<HTMLInputElement>("[data-ingredient-field=minutes] input")!, "15");
    // Not in the bitterness, the shares, the donut or the hop total.
    expect(figure()).toBe("19 IBU");
    expect(shares("hops")).toEqual(["100 %"]);
    expect(other.querySelector("[data-ingredient-share]")!.textContent).toBe("");
    expect(recipe().querySelectorAll("[data-share-chart] [data-share-slice]")).toHaveLength(1);
    expect(total("hops")).toEqual(["Total hops", "30 g", "100 %"]);
    const all = [...section("hops").querySelectorAll("[data-ingredient-total-all] td")].map((td) => td.textContent);
    expect([all[1], all[all.length - 3], all[all.length - 2]]).toEqual(["Total ingredients", "40 g", ""]);
    // In the schedule: added 45 min after the start, as a grey square.
    const schedule = recipe().querySelector("[data-hop-schedule]")!;
    const items = [...schedule.querySelectorAll<HTMLTableRowElement>("[data-schedule-list] tbody tr")].map((tr) => [...tr.cells].map((td) => td.textContent));
    expect(items).toEqual([
      ["0 min (start)", "Hallertauer Tradition", "60 min", "30 g"],
      ["45 min", "Irish Moss", "15 min", "10 g"],
    ]);
    const square = schedule.querySelector("[data-schedule-hop=other-0] rect")!;
    expect(square.getAttribute("fill")).toBe("var(--series-other)");
    // Written as its own list after the hops.
    expect(await download()).toContain(
      '    "hops": [\n      { "name": "Hallertauer Tradition", "grams": 30, "alpha": 5.5, "minutes": 60 }\n    ],\n' +
        '    "others": [\n      { "name": "Irish Moss", "grams": 10, "minutes": 15 }\n    ]\n',
    );
    // A problem names it and opens the Boiling tab.
    await type(rows("others")[0].querySelector<HTMLInputElement>("[data-ingredient-field=grams] input")!, "");
    expect(recipe().textContent).toContain("Other addition 1: Other addition 1 needs an amount in grams.");
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mash")!.click());
    await act(async () => button("Other addition 1").click());
    expect(recipe().querySelector("#tab-hops")!.getAttribute("aria-selected")).toBe("true");
  });

  it("ACC-083 shows each malt's colour from its EBC next to the field", async () => {
    await open();
    await add("malts", "Pilsner malt", "4500", { ebc: "3.5" });
    await add("malts", "Chocolate malt", "200", { ebc: "900" });
    await add("malts", "Munich malt", "500");
    const swatch = (i: number) => rows("malts")[i].querySelector<HTMLElement>("[data-malt-swatch]")!;
    expect([swatch(0).style.background, swatch(1).style.background]).toEqual(["rgb(255, 216, 120)", "rgb(54, 8, 10)"]);
    expect(swatch(0).title).toBe("About the colour of 3.5 EBC");
    expect(swatch(2).className).toContain("invisible");
  });

  it("ACC-076 Malt: Malt Overview, then Malt; Boiling: Hops Overview, Boil Schedule, then Boil Ingredients", async () => {
    await open();
    const headings = () => [...recipe().querySelectorAll("[role=tabpanel] h3")].map((h) => h.textContent?.trim());
    const after = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(headings()).toEqual(["Malt Overview", "Malt"]);
    const [overview, malt] = [...recipe().querySelectorAll("[role=tabpanel] h3")];
    expect(after(overview, recipe().querySelector("[data-overview]")!)).toBe(true);
    expect(after(malt, section("malts"))).toBe(true);
    await showTab("hops");
    expect(headings()).toEqual(["Hops Overview", "Boil Schedule", "Boil Ingredients"]);
    const [, schedule, ingredients] = [...recipe().querySelectorAll("[role=tabpanel] h3")];
    expect(after(schedule, recipe().querySelector("[data-hop-schedule]")!)).toBe(true);
    expect(after(recipe().querySelector("[data-hop-schedule]")!, ingredients)).toBe(true);
    expect(after(ingredients, section("hops"))).toBe(true);
  });

  it("ACC-077 the hop schedule boils as long as the longest cooking time and adds each hop that much earlier", async () => {
    await open();
    await showTab("hops");
    const schedule = () => recipe().querySelector("[data-hop-schedule]")!;
    expect(schedule().textContent).toContain("Enter the amounts and cooking times to see when each goes into the boil.");
    await add("hops", "Saaz", "10", { minutes: "0" });
    await add("hops", "Hallertauer Tradition", "30", { minutes: "60" });
    await add("hops", "Tettnanger", "20", { minutes: "10" });
    await add("hops", "Cascade", "15");
    expect(schedule().querySelector("[data-boil-time]")!.textContent).toBe("Total boil time: 60 min (the longest cooking time)");
    expect([...schedule().querySelectorAll("[data-schedule-list] thead th")].map((th) => th.textContent)).toEqual([
      "Add at",
      "Ingredient",
      "Cooking time",
      "Amount",
    ]);
    const items = [...schedule().querySelectorAll<HTMLTableRowElement>("[data-schedule-list] tbody tr")].map((tr) => [...tr.cells].map((td) => td.textContent));
    expect(items).toEqual([
      ["0 min (start)", "Hallertauer Tradition", "60 min", "30 g"],
      ["50 min", "Tettnanger", "10 min", "20 g"],
      ["60 min (flame-out)", "Saaz", "0 min", "10 g"],
    ]);
    const dots = [...schedule().querySelectorAll("[data-schedule-hop]")];
    expect(dots.map((g) => (g as HTMLElement).dataset.scheduleHop)).toEqual(["1", "2", "0"]);
    expect(dots.map((g) => g.querySelector("circle")!.getAttribute("fill"))).toEqual(["var(--series-2)", "var(--series-3)", "var(--series-1)"]);
    expect(dots[0].querySelector("title")!.textContent).toBe("Hallertauer Tradition: 30 g, add at 0 min (start), cooks 60 min");
    expect(dots[2].querySelector("title")!.textContent).toBe("Saaz: 10 g, add at 60 min (flame-out), cooks 0 min");
    // The start of the boil is at the left, its end at the right.
    const cx = dots.map((g) => Number(g.querySelector("circle")!.getAttribute("cx")));
    expect(cx[0]).toBeLessThan(cx[1]);
    expect(cx[1]).toBeLessThan(cx[2]);
    const ticks = [...schedule().querySelectorAll("[data-schedule-tick] text")].map((t) => t.textContent);
    expect([ticks[0], ticks.at(-1)]).toEqual(["start", "end"]);
    expect(schedule().querySelector("[data-schedule-missing]")!.textContent).toBe("No cooking time yet: hop 4.");
  });

});

describe("App, the Water tab (QE-36)", () => {
  const recipe = () => root.querySelector("[aria-label=Recipe]")!;
  const input = (label: string) =>
    [...recipe().querySelectorAll<HTMLLabelElement>("[role=tabpanel] label")].find((l) => l.textContent?.startsWith(label))!.querySelector("input")!;
  async function open(content: Recipe = { version: 3, name: "Brew", mashing_process: { goals: [{ type: "MashIn" }] } }) {
    const store = new MemoryStore();
    await store.put(newDoc("Brew", content));
    await show(store);
    await act(async () => recipe().querySelector<HTMLElement>("#tab-water")!.click());
  }
  async function type(field: HTMLInputElement, value: string) {
    await act(async () => {
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function download(): Promise<string> {
    let blob: Blob | undefined;
    Object.assign(URL, { createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL: () => undefined });
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    await menu("Brew", "Download");
    HTMLAnchorElement.prototype.click = click;
    const file = blob!;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(file);
    });
  }

  it("ACC-078 has the fields Mash water, Sparge water, Top-up water and Knockout volume; they are written on one line", async () => {
    await open();
    expect(recipe().querySelector("#tab-water")!.getAttribute("aria-selected")).toBe("true");
    expect(recipe().querySelector("[role=tabpanel] h3")!.textContent?.trim()).toBe("Water");
    const labels = [...recipe().querySelectorAll("[role=tabpanel] label")].map((l) => l.textContent);
    expect(labels).toEqual(["Mash waterL", "Sparge waterL", "Top-up waterL", "Knockout volumeL", "Original gravity (target)°P", "Final gravity°P"]);
    for (const hint of ["strike water", "while lautering", "after lautering to reach the original gravity", "end of the boil"]) {
      expect(recipe().textContent).toContain(hint);
    }
    await type(input("Top-up water"), "2");
    await type(input("Mash water"), "16");
    await type(input("Sparge water"), "14");
    expect(await download()).toContain('  "water": { "mash": 16, "sparge": 14, "top_up": 2 }\n}\n');
    await type(input("Mash water"), "-1");
    expect(recipe().textContent).toContain("Mash water: The mash water must be a number of at least 0 litres.");
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mash")!.click());
    await act(async () => button("Mash water").click());
    expect(recipe().querySelector("#tab-water")!.getAttribute("aria-selected")).toBe("true");
    for (const label of ["Mash water", "Sparge water", "Top-up water"]) {
      await type(input(label), "");
    }
    expect(await download()).not.toContain("water");
  });

  it("ACC-079 shows the total water and the mash thickness; the knockout volume is the Malt tab's", async () => {
    await open({
      version: 3,
      name: "Brew",
      mashing_process: { goals: [{ type: "MashIn" }] },
      ingredients: { malts: [{ name: "Pilsner malt", grams: 4500 }, { name: "Munich malt", grams: 500 }] },
    });
    const total = () => recipe().querySelector("[data-total-water]")!.textContent;
    const thickness = () => recipe().querySelector("[data-mash-thickness]")!.textContent;
    const hint = () => recipe().querySelector("[data-mash-thickness-hint]")!.textContent;
    expect([total(), thickness(), hint()]).toEqual(["–", "–", "Enter the mash water."]);
    await type(input("Sparge water"), "14");
    expect(total()).toBe("14 L");
    await type(input("Mash water"), "16");
    await type(input("Top-up water"), "2.5");
    expect([total(), thickness()]).toEqual(["32.5 L", "3.2 L/kg"]);
    expect(hint()).toContain("typical 2.5–4 L/kg");
    await type(input("Knockout volume"), "20");
    await act(async () => recipe().querySelector<HTMLElement>("#tab-malts")!.click());
    // The Malt tab takes it from here: it only asks for the malts' EBC now.
    expect(recipe().querySelector("[data-figure-hint]")!.textContent).toBe("Enter the EBC of malts 1, 2.");
  });

  it("ACC-079 without malts the mash thickness says where they go", async () => {
    await open();
    await type(input("Mash water"), "16");
    expect([recipe().querySelector("[data-mash-thickness]")!.textContent, recipe().querySelector("[data-mash-thickness-hint]")!.textContent]).toEqual([
      "–",
      "Enter the malts on the Malt tab.",
    ]);
  });

  it("ACC-081 the Gravity section has the target original gravity and the final gravity, with the alcohol", async () => {
    await open();
    expect([...recipe().querySelectorAll("[role=tabpanel] h3")].map((h) => h.textContent?.trim())).toEqual(["Water", "Gravity"]);
    const alcohol = () => [recipe().querySelector("[data-alcohol]")!.textContent, recipe().querySelector("[data-alcohol-hint]")!.textContent];
    expect(alcohol()).toEqual(["–", "Enter the original gravity and the final gravity."]);
    await type(input("Original gravity (target)"), "12");
    await type(input("Final gravity"), "2.5");
    expect(alcohol()[0]).toBe("5.1 % vol");
    expect(recipe().querySelector("[data-attenuation]")!.textContent).toBe("79 %");
    expect(await download()).toContain('"batch": { "plato": 12, "final_plato": 2.5 }');
    await type(input("Final gravity"), "12");
    expect(alcohol()).toEqual(["–", "The final gravity must be below the original gravity."]);
    await type(input("Final gravity"), "41");
    expect(recipe().textContent).toContain("Final gravity: The final gravity must be a number from 0 to 40 °P.");
    await act(async () => recipe().querySelector<HTMLElement>("#tab-mash")!.click());
    await act(async () => button("Final gravity").click());
    expect(recipe().querySelector("#tab-water")!.getAttribute("aria-selected")).toBe("true");
  });
});
