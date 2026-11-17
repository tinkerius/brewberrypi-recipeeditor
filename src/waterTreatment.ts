/**
 * The water treatment (EDT-069, QE-61; app RCP-015 `water.treatment`, Q-46): the tap water's residual alkalinity and
 * what lowers it — boiling the brewing water, brewing gypsum, acid malt and lactic acid — and the residual alkalinity
 * after treatment, compared with the typical target for the beer's colour. All in °dH (German degrees). Computed
 * values are never stored.
 *
 * The effects, from the chemistry (RA = carbonate hardness − calcium hardness / 3.5 − magnesium hardness / 7):
 * - boiling precipitates calcium carbonate down to about 3 °dH of carbonate hardness; each °dH removed takes as much
 *   calcium hardness with it, so the RA falls by (1 − 1/3.5) per °dH removed;
 * - brewing gypsum (CaSO₄·2H₂O): 1 g per 10 L adds 23.3 mg/L of calcium, 3.26 °dH of calcium hardness, so the RA falls
 *   by 3.26 / 3.5 = 0.93 °dH;
 * - lactic acid 80 % (1.2 g/ml): 1 ml per 10 L is 1.07 mmol/L of acid, against 0.357 mmol/L per °dH: −2.99 °dH;
 * - acid malt holds about 3 % lactic acid (2–4 %); it acts on the mash water: its lactic acid in mmol per litre of
 *   mash water, over 0.357 mmol/L per °dH.
 */

import { acidMaltGrams, beerColourOf, ingredientsOf, isObject, totalGrams, validWater, waterOf, type Recipe } from "./model";

/** The fields of `water.treatment` in the file's order. */
export const TREATMENT_FIELDS = ["alkalinity", "carbonate_hardness", "boil", "gypsum", "acid_malt", "lactic_acid"] as const;
export type TreatmentField = (typeof TREATMENT_FIELDS)[number];

/** The chemistry's constants (see above). */
export const TREATMENT_RULES = {
  boiledHardness: 3, // °dH of carbonate hardness left after boiling
  boilPerDegree: 1 - 1 / 3.5,
  gypsumPerGram: (100 * (40.078 / 172.17)) / 7.147 / 3.5, // °dH per g per 10 L
  lacticPerMl: (1.2 * 0.8 * 1000) / 90.08 / 10 / 0.3566, // °dH per ml per 10 L
  acidMaltLactic: 0.03, // share of lactic acid in acid malt
  lacticMolar: 90.08, // g/mol
  mmolPerDegree: 0.3566, // mmol/L of alkalinity per °dH
} as const;

/** The steps that are ticked to use them, like the mashing rests (EDT-069, QE-63). */
export const TREATMENT_STEPS = ["boil", "gypsum", "acid_malt", "lactic_acid"] as const;
export type TreatmentStep = (typeof TREATMENT_STEPS)[number];

/** Whether a step is ticked: boiling while `boil` is true, the others while their key is there (maybe still empty). */
export function stepOn(recipe: Recipe, step: TreatmentStep): boolean {
  const t = treatmentOf(recipe);
  return step === "boil" ? t.boil === true : step in t;
}

/**
 * The recipe with a step ticked or unticked (EDT-069): ticked, boiling is `boil: true`, another step its key with no
 * value yet (`null`, a problem until entered; no preset, QE-63); unticked, the step's keys leave the file (boiling's
 * carbonate hardness too).
 */
export function withTreatmentStep(recipe: Recipe, step: TreatmentStep, on: boolean): Recipe {
  if (on) {
    return withTreatmentField(recipe, step, step === "boil" ? true : null);
  }
  const off = withTreatmentField(recipe, step, undefined);
  return step === "boil" ? withTreatmentField(off, "carbonate_hardness", undefined) : off;
}

/** The typical upper limits (EDT-064): gypsum and acid malt. */
export const TREATMENT_TYPICAL = { gypsum: 3, acidMalt: 5 } as const;

/** The typical residual alkalinity by beer colour (EDT-069): at most this many °dH up to this colour. */
export const TARGET_BY_COLOUR = [
  { upToEbc: 10, max: 2, beers: "Pils" },
  { upToEbc: 20, max: 5, beers: "Helles, Weizen, Pale Ale" },
  { upToEbc: 40, max: 10, beers: "Märzen" },
  { upToEbc: Infinity, max: 15, beers: "Dunkel, Stout" },
] as const;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function treatmentOf(recipe: Recipe): Record<string, unknown> {
  const treatment = waterOf(recipe).treatment;
  return isObject(treatment) ? treatment : {};
}

/**
 * The recipe with a treatment field set, or removed when `value` is undefined (or `false` for boil); an empty
 * treatment leaves the water, and empty water the file (EDT-069). Kept in the file's order; any other key as found.
 */
export function withTreatmentField(recipe: Recipe, field: TreatmentField, value: unknown): Recipe {
  const treatment: Record<string, unknown> = { ...treatmentOf(recipe) };
  if (value === undefined || (field === "boil" && value === false)) {
    delete treatment[field];
  } else {
    treatment[field] = value;
  }
  const ordered: Record<string, unknown> = {};
  for (const key of TREATMENT_FIELDS) {
    if (key in treatment) {
      ordered[key] = treatment[key];
    }
  }
  const { treatment: _old, ...water } = waterOf(recipe);
  const nextWater = Object.keys(treatment).length === 0 ? water : { ...water, treatment: { ...ordered, ...treatment } };
  const { water: _w, ...others } = recipe;
  return Object.keys(nextWater).length === 0 ? (others as Recipe) : { ...others, water: nextWater };
}

/** An effect in °dH, or why it can't be worked out yet. */
export type Effect = { value: number } | { missing: ("carbonate_hardness" | "malts" | "mash")[] } | undefined;

export interface Treatment {
  boil: Effect;
  gypsum: Effect;
  acidMalt: Effect;
  lacticAcid: Effect;
  /** The residual alkalinity after treatment: the tap water's plus every effect worked out; undefined without it. */
  result?: number;
  /** The typical target for the beer's colour; undefined while the beer colour is unknown. */
  target?: { max: number; ebc: number; beers: string };
}

/** The effects of the treatment and the residual alkalinity after it (EDT-069). */
export function treatmentEffects(recipe: Recipe): Treatment {
  const t = treatmentOf(recipe);
  const effects: Treatment = { boil: undefined, gypsum: undefined, acidMalt: undefined, lacticAcid: undefined };
  if (t.boil === true) {
    const hardness = t.carbonate_hardness;
    effects.boil =
      finite(hardness) && hardness >= 0
        ? { value: -Math.max(0, hardness - TREATMENT_RULES.boiledHardness) * TREATMENT_RULES.boilPerDegree }
        : { missing: ["carbonate_hardness"] };
  }
  if (finite(t.gypsum) && t.gypsum > 0) {
    effects.gypsum = { value: -t.gypsum * TREATMENT_RULES.gypsumPerGram };
  }
  if (finite(t.lactic_acid) && t.lactic_acid > 0) {
    effects.lacticAcid = { value: -t.lactic_acid * TREATMENT_RULES.lacticPerMl };
  }
  if (finite(t.acid_malt) && t.acid_malt > 0) {
    const grams = totalGrams(ingredientsOf(recipe, "malts"));
    const mash = waterOf(recipe).mash;
    const missing: ("malts" | "mash")[] = [];
    if (grams <= 0) {
      missing.push("malts");
    }
    if (!validWater(mash) || mash <= 0) {
      missing.push("mash");
    }
    if (missing.length > 0) {
      effects.acidMalt = { missing };
    } else {
      const lacticMmol = acidMaltGrams(recipe)! * TREATMENT_RULES.acidMaltLactic * (1000 / TREATMENT_RULES.lacticMolar);
      effects.acidMalt = { value: -lacticMmol / (mash as number) / TREATMENT_RULES.mmolPerDegree };
    }
  }
  if (finite(t.alkalinity)) {
    effects.result = [effects.boil, effects.gypsum, effects.acidMalt, effects.lacticAcid].reduce(
      (sum, e) => sum + (e && "value" in e ? e.value : 0),
      t.alkalinity,
    );
  }
  const colour = beerColourOf(recipe).value;
  if (colour !== undefined) {
    const band = TARGET_BY_COLOUR.find((b) => colour <= b.upToEbc)!;
    effects.target = { max: band.max, ebc: Math.round(colour), beers: band.beers };
  }
  return effects;
}

export { acidMaltGrams };

/** The total malt in grams: the malts of the Malt tab and the acid malt of the water treatment (EDT-070). */
export function totalMaltGrams(recipe: Recipe): number {
  return totalGrams(ingredientsOf(recipe, "malts")) + (acidMaltGrams(recipe) ?? 0);
}

/**
 * The total amounts of the steps for this brew (EDT-069, QE-66), read-only: gypsum and lactic acid for the mash water
 * (their doses are per 10 L of it), the acid malt in grams of the total malt. Undefined where it can't be worked out.
 */
export function treatmentTotals(recipe: Recipe): { gypsum?: number; acidMalt?: number; lacticAcid?: number } {
  const t = treatmentOf(recipe);
  const mash = waterOf(recipe).mash;
  const perMash = (dose: unknown) => (finite(dose) && dose >= 0 && validWater(mash) ? (dose * mash) / 10 : undefined);
  return { gypsum: perMash(t.gypsum), acidMalt: acidMaltGrams(recipe), lacticAcid: perMash(t.lactic_acid) };
}

/** °dH with one decimal and its sign: "−2.5 °dH", "+1 °dH", "7.8 °dH". */
export function degrees(value: number, signed = false): string {
  const rounded = Math.round(value * 10) / 10;
  const text = String(Math.abs(rounded));
  const sign = rounded < 0 ? "−" : signed && rounded > 0 ? "+" : "";
  return `${sign}${text} °dH`;
}

/** A number as shown in a formula: at most `digits` decimals, no trailing zeros, "−" for minus. */
function num(value: number, digits = 2): string {
  const text = String(Math.round(value * 10 ** digits) / 10 ** digits);
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
}

/** The factors of the formulas, from the rules, as shown (EDT-069). */
export const FORMULA_FACTORS = {
  boil: num(TREATMENT_RULES.boilPerDegree, 3),
  calcium: num(100 * (40.078 / 172.17), 1), // mg/L of calcium per g of gypsum per 10 L
  calciumPerDegree: num(7.147, 2), // mg/L of calcium per °dH
  gypsum: num(TREATMENT_RULES.gypsumPerGram),
  acidMalt: num(((TREATMENT_RULES.acidMaltLactic * 1000) / TREATMENT_RULES.lacticMolar) * 10 / TREATMENT_RULES.mmolPerDegree),
  lactic: num(TREATMENT_RULES.lacticPerMl),
  mmol: num(TREATMENT_RULES.mmolPerDegree, 3),
} as const;

export type FormulaRow = "alkalinity" | TreatmentStep | "result";

/**
 * How a row's value is worked out (EDT-069, QE-65): the formula in words and symbols, and, once it can be worked out,
 * the same formula with the recipe's numbers and its result, rounded as shown so it reads like a check.
 */
export function stepFormula(recipe: Recipe, row: FormulaRow): { formula: string; filled?: string } {
  const t = treatmentOf(recipe);
  const effects = treatmentEffects(recipe);
  const f = FORMULA_FACTORS;
  const dh = (value: number) => `${num(value, 1)} °dH`;
  switch (row) {
    case "alkalinity":
      return {
        formula: "RA = carbonate hardness − calcium hardness ÷ 3.5 − magnesium hardness ÷ 7 (each in °dH, from the water analysis)",
        filled: finite(t.alkalinity) ? `starting value ${dh(t.alkalinity)}` : undefined,
      };
    case "boil": {
      const hardness = t.carbonate_hardness;
      const effect = effects.boil;
      let filled: string | undefined;
      if (t.boil === true && finite(hardness) && effect && "value" in effect) {
        filled =
          hardness > TREATMENT_RULES.boiledHardness
            ? `ΔRA = −(${num(hardness)} − ${TREATMENT_RULES.boiledHardness}) × ${f.boil} = ${dh(effect.value)}`
            : `ΔRA = 0 °dH (carbonate hardness ${num(hardness)} °dH, not above ${TREATMENT_RULES.boiledHardness} °dH)`;
      }
      return { formula: `ΔRA = −(carbonate hardness − ${TREATMENT_RULES.boiledHardness} °dH) × (1 − 1 ÷ 3.5) = −(KH − 3) × ${f.boil}`, filled };
    }
    case "gypsum": {
      const effect = effects.gypsum;
      return {
        formula: `ΔRA = −gypsum [g/10 L mash water] × ${f.calcium} mg/L calcium ÷ ${f.calciumPerDegree} mg/L per °dH ÷ 3.5 = −gypsum × ${f.gypsum}`,
        filled: finite(t.gypsum) && effect && "value" in effect ? `ΔRA = −${num(t.gypsum)} × ${f.gypsum} = ${dh(effect.value)}` : undefined,
      };
    }
    case "acid_malt": {
      const effect = effects.acidMalt;
      const kg = totalMaltGrams(recipe) / 1000;
      const mash = waterOf(recipe).mash;
      return {
        formula:
          `ΔRA = −(total malt [g] × acid malt [% of total malt] ÷ 100 × ${num(TREATMENT_RULES.acidMaltLactic * 100)} % lactic acid ÷ ` +
          `${TREATMENT_RULES.lacticMolar} g/mol) ÷ mash water [L] ÷ ${f.mmol} mmol/L per °dH ≈ −${f.acidMalt} × total malt [kg] × ` +
          "acid malt [% of total malt] ÷ mash water [L]",
        filled:
          finite(t.acid_malt) && finite(mash) && effect && "value" in effect
            ? `ΔRA = −${f.acidMalt} × ${num(kg)} × ${num(t.acid_malt)} ÷ ${num(mash)} = ${dh(effect.value)}`
            : undefined,
      };
    }
    case "lactic_acid": {
      const effect = effects.lacticAcid;
      return {
        formula:
          `ΔRA = −lactic acid [ml/10 L mash water] × 1.2 g/ml × 80 % ÷ ${TREATMENT_RULES.lacticMolar} g/mol × 1000 ÷ 10 L ÷ ${f.mmol} ` +
          `mmol/L per °dH = −lactic acid × ${f.lactic}`,
        filled: finite(t.lactic_acid) && effect && "value" in effect ? `ΔRA = −${num(t.lactic_acid)} × ${f.lactic} = ${dh(effect.value)}` : undefined,
      };
    }
    case "result": {
      const parts = [effects.boil, effects.gypsum, effects.acidMalt, effects.lacticAcid]
        .filter((e): e is { value: number } => e !== undefined && "value" in e)
        .map((e) => (e.value < 0 ? ` − ${num(-e.value, 1)}` : ` + ${num(e.value, 1)}`));
      return {
        formula: "RA after treatment = the tap water's RA + the effects of the ticked steps",
        filled:
          effects.result !== undefined && finite(t.alkalinity)
            ? `RA = ${num(t.alkalinity, 1)}${parts.join("")} = ${dh(effects.result)}`
            : undefined,
      };
    }
  }
}
