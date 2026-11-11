import { describe, expect, it } from "vitest";
import { toRecipe } from "../src/model";
import { acidMaltGrams, stepFormula, totalMaltGrams, treatmentEffects, treatmentTotals } from "../src/waterTreatment";

/** The example: 4.6 kg of pale malt (9 EBC in 24 L), 18 L mash water, tap water 10.3 °dH RA and 14 °dH KH. */
const example = (treatment: Record<string, unknown>) =>
  toRecipe({
    version: 3,
    name: "W",
    mashing_process: { goals: [] },
    ingredients: { malts: [{ name: "Pilsner malt", grams: 4600, ebc: 7 }] },
    batch: { liters: 24 },
    water: { mash: 18, treatment },
  });

describe("water treatment formulas (EDT-069, QE-65)", () => {
  it("ACC-098 every row's ⓘ shows its formula and, once it can be worked out, the recipe's numbers", () => {
    const full = example({ alkalinity: 10.3, carbonate_hardness: 14, boil: true, gypsum: 1, acid_malt: 1, lactic_acid: 0.5 });
    expect(stepFormula(full, "alkalinity")).toEqual({
      formula: "RA = carbonate hardness − calcium hardness ÷ 3.5 − magnesium hardness ÷ 7 (each in °dH, from the water analysis)",
      filled: "starting value 10.3 °dH",
    });
    expect(stepFormula(full, "boil")).toEqual({
      formula: "ΔRA = −(carbonate hardness − 3 °dH) × (1 − 1 ÷ 3.5) = −(KH − 3) × 0.714",
      filled: "ΔRA = −(14 − 3) × 0.714 = −7.9 °dH",
    });
    expect(stepFormula(full, "gypsum")).toEqual({
      formula: "ΔRA = −gypsum [g/10 L mash water] × 23.3 mg/L calcium ÷ 7.15 mg/L per °dH ÷ 3.5 = −gypsum × 0.93",
      filled: "ΔRA = −1 × 0.93 = −0.9 °dH",
    });
    expect(stepFormula(full, "acid_malt")).toEqual({
      formula:
        "ΔRA = −(total malt [g] × acid malt [% of total malt] ÷ 100 × 3 % lactic acid ÷ 90.08 g/mol) ÷ mash water [L] ÷ 0.357 mmol/L per °dH ≈ " +
        "−9.34 × total malt [kg] × acid malt [% of total malt] ÷ mash water [L]",
      filled: "ΔRA = −9.34 × 4.65 × 1 ÷ 18 = −2.4 °dH", // the total malt, the acid malt included
    });
    expect(stepFormula(full, "lactic_acid")).toEqual({
      formula: "ΔRA = −lactic acid [ml/10 L mash water] × 1.2 g/ml × 80 % ÷ 90.08 g/mol × 1000 ÷ 10 L ÷ 0.357 mmol/L per °dH = −lactic acid × 2.99",
      filled: "ΔRA = −0.5 × 2.99 = −1.5 °dH",
    });
    expect(stepFormula(full, "result")).toEqual({
      formula: "RA after treatment = the tap water's RA + the effects of the ticked steps",
      filled: "RA = 10.3 − 7.9 − 0.9 − 2.4 − 1.5 = −2.4 °dH",
    });
    // The filled-in numbers check against the computed effects.
    expect(Math.round(treatmentEffects(full).result! * 10) / 10).toBe(-2.4);
    // Boiling soft water does nothing.
    expect(stepFormula(example({ boil: true, carbonate_hardness: 2 }), "boil").filled).toBe(
      "ΔRA = 0 °dH (carbonate hardness 2 °dH, not above 3 °dH)",
    );
    // Without the inputs only the formula.
    const empty = example({ boil: true, gypsum: null });
    for (const row of ["alkalinity", "boil", "gypsum", "acid_malt", "lactic_acid", "result"] as const) {
      expect(stepFormula(empty, row).filled, row).toBeUndefined();
    }
  });

  it("ACC-099 the totals for the brew: gypsum and lactic acid for the mash water, the acid malt of the total malt", () => {
    const r = example({ gypsum: 1, acid_malt: 1, lactic_acid: 0.5 });
    // 1 % of the total malt, the acid malt included: 1/99 of 4600 g.
    expect(Math.round(acidMaltGrams(r)! * 10) / 10).toBe(46.5);
    expect(Math.round(totalMaltGrams(r))).toBe(4646);
    expect(treatmentTotals(r)).toEqual({ gypsum: 1.8, acidMalt: acidMaltGrams(r), lacticAcid: 0.9 });
    // Without mash water no totals of the doses per 10 L.
    const dry = toRecipe({ version: 3, name: "W", mashing_process: { goals: [] }, water: { treatment: { gypsum: 1 } } });
    expect(treatmentTotals(dry)).toEqual({ gypsum: undefined, acidMalt: undefined, lacticAcid: undefined });
  });
});
