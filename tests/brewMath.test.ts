import { describe, expect, it } from "vitest";
import { beerColourEbc, beerColourHex, bitternessIbu, platoToSg } from "../src/brewMath";

describe("brewing figures (EDT-048, EDT-049)", () => {
  it("ACC-073 Morey: 1 lb of 10 °L malt in 1 gal is MCU 10, SRM 7.24 (EBC 14.3)", () => {
    const ebcOf10Lovibond = (10 * 1.3546 - 0.76) / 0.508;
    const ebc = beerColourEbc([{ grams: 453.592, ebc: ebcOf10Lovibond }], 3.78541);
    expect(ebc / 1.97).toBeCloseTo(1.4922 * 10 ** 0.6859, 2);
    expect(beerColourEbc([], 20)).toBe(0);
    expect([beerColourHex(0), beerColourHex(9), beerColourHex(500)]).toEqual(["#FFE699", "#FBB123", "#36080A"]);
  });

  it("ACC-074 Tinseth: 60 min at 1.050 is a utilisation of 0.231; no boil, no bitterness", () => {
    expect(platoToSg(12.39)).toBeCloseTo(1.05, 3);
    // 10 % alpha, 10 g in 1 l: 1000 mg/l of alpha acid.
    expect(bitternessIbu([{ grams: 10, alpha: 10, minutes: 60 }], 1, 12.39) / 1000).toBeCloseTo(0.231, 3);
    expect(bitternessIbu([{ grams: 30, alpha: 5, minutes: 0 }], 20, 12)).toBe(0);
  });
});
