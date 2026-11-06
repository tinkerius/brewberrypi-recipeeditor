import { describe, expect, it } from "vitest";
import { dropSlot, moveItem, targetIndex } from "../src/ui/reorder";

describe("reordering (EDT-012)", () => {
  it("ACC-038 finds the slot under the pointer", () => {
    const mids = [40, 140, 240];
    expect(dropSlot(0, mids)).toBe(0);
    expect(dropSlot(100, mids)).toBe(1);
    expect(dropSlot(239, mids)).toBe(2);
    expect(dropSlot(500, mids)).toBe(3);
  });

  it("ACC-038 moves an item to the slot; its own slot and the next keep it in place", () => {
    expect(targetIndex(0, 3)).toBe(2);
    expect(targetIndex(2, 0)).toBe(0);
    expect(targetIndex(1, 1)).toBe(1);
    expect(targetIndex(1, 2)).toBe(1);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});
