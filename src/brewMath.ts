/**
 * Brewing figures from the Malt and Hops tabs (EDT-048, EDT-049, QE-35): the beer colour (Morey) and the bitterness
 * (Tinseth). Pure functions; the editor computes them, the recipe file never stores them (app RCP-013).
 */

const LB_PER_KG = 2.20462;
const L_PER_GAL = 3.78541;

/** A malt's EBC as degrees Lovibond (EBC → SRM → °L). */
function lovibond(ebc: number): number {
  return (ebc * 0.508 + 0.76) / 1.3546;
}

/**
 * The beer colour in EBC by Morey's formula: malt colour units MCU = Σ(lb · °L) / gal, SRM = 1.4922 · MCU^0.6859,
 * EBC = SRM · 1.97. `malts` are the grams and EBC of each malt, `liters` the wort volume after the boil.
 */
export function beerColourEbc(malts: { grams: number; ebc: number }[], liters: number): number {
  const mcu = malts.reduce((sum, m) => sum + (m.grams / 1000) * LB_PER_KG * lovibond(m.ebc), 0) / (liters / L_PER_GAL);
  return mcu > 0 ? 1.4922 * mcu ** 0.6859 * 1.97 : 0;
}

/** °Plato as specific gravity. */
export function platoToSg(plato: number): number {
  return 1 + plato / (258.6 - (plato / 258.2) * 227.1);
}

/**
 * The bitterness in IBU by Tinseth's formula: per hop, utilisation U = 1.65 · 0.000125^(SG − 1) · (1 − e^(−0.04 t)) /
 * 4.15 times the added alpha acid in mg/l (alpha/100 · g · 1000 / l). `alpha` in percent, `minutes` the boil time.
 */
export function bitternessIbu(hops: { grams: number; alpha: number; minutes: number }[], liters: number, plato: number): number {
  const bigness = 1.65 * 0.000125 ** (platoToSg(plato) - 1);
  return hops.reduce((sum, h) => {
    const time = (1 - Math.exp(-0.04 * h.minutes)) / 4.15;
    return sum + bigness * time * ((h.alpha / 100) * h.grams * 1000) / liters;
  }, 0);
}

/** The widely published SRM colour chart, SRM 1 … 40 (one colour per whole SRM). */
const SRM_COLOURS = [
  "#FFE699", "#FFD878", "#FFCA5A", "#FFBF42", "#FBB123", "#F8A600", "#F39C00", "#EA8F00", "#E58500", "#DE7C00",
  "#D77200", "#CF6900", "#CB6200", "#C35900", "#BB5100", "#B54C00", "#B04500", "#A63E00", "#A13700", "#9B3200",
  "#952D00", "#8E2900", "#882300", "#821E00", "#7B1A00", "#771900", "#701400", "#6A0E00", "#660D00", "#5E0B00",
  "#5A0A02", "#600903", "#520907", "#4C0505", "#470606", "#440607", "#3F0708", "#3B0607", "#3A070B", "#36080A",
];

/** A colour for a beer of this EBC, shown next to the number (EDT-048): the chart colour of its SRM (EBC / 1.97). */
export function beerColourHex(ebc: number): string {
  const srm = Math.min(40, Math.max(1, Math.round(ebc / 1.97)));
  return SRM_COLOURS[srm - 1];
}
