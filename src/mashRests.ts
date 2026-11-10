/**
 * The rests of a mashing plan (app RCP-012, QE-32) and everything the editor knows about them: names, typical
 * temperatures and durations, presets, enzymes and texts. The single source of these values (QE-33): the Mashing
 * table, the temperature ladder and the schedule's warnings all read them from here. The texts are the product
 * owner's (2026-11-10), verbatim.
 */

/** The highest mash temperature: above it α-amylase is destroyed too (Mash-out, EDT-036). */
export const MASH_TEMPERATURE_LIMIT = 78;

/** The rests of a mashing plan, in the order the editor shows and writes them (app RCP-012, QE-32). */
export const MASH_REST_IDS = [
  "PreMash",
  "AcidRest",
  "BetaGlucanRest",
  "FerulicAcidRest",
  "ProteinRest",
  "MaltoseRest",
  "CombinedRest",
  "SaccharificationRest",
  "MashOut",
] as const;

export type MashRestId = (typeof MASH_REST_IDS)[number];

export type MashRestFlag = "obsolete" | "optional" | "always" | "conversion";

export interface MashRestInfo {
  /** The full name, as in the product owner's table (EDT-031). */
  label: string;
  /** A short name, for problems ("Mashing, Maltose rest"). */
  short: string;
  /** The typical temperature range, as text. */
  range: string;
  /** The typical temperature range (°C, inclusive); outside it the editor warns (EDT-033). */
  tempMin: number;
  tempMax: number;
  /** The typical temperature: preset when the rest is ticked (EDT-032), marked in the ladder (EDT-036). */
  tempTypical: number;
  /** The typical duration, as text. */
  duration: string;
  /** The duration preset when the rest is ticked (EDT-032). */
  minutes: number;
  /** The typical duration in minutes; outside it the schedule warns (EDT-038). null: no limit. */
  durationMin: number | null;
  durationMax: number | null;
  /** The active enzymes, short (the ladder's details, EDT-037). */
  enzymes: string[];
  /** A few words on the effect, the ladder's label (EDT-036). */
  summary: string;
  /** obsolete: hardly used today; always: belongs in every mash; conversion: converts the starch (EDT-038). */
  flags: MashRestFlag[];
  /** What the rest does: enzymes, effect, when it is useful. */
  about: [string, string][];
}

export const MASH_RESTS: Record<MashRestId, MashRestInfo> = {
  PreMash: {
    label: "Pre-mash / Dough-in rest (soaking)",
    short: "Pre-mash",
    range: "Room temp. to 40 °C, typ. ~35 °C",
    tempMin: 15,
    tempMax: 40,
    duration: "15–30 min (cold: up to several hours)",
    tempTypical: 35,
    minutes: 20,
    durationMin: 15,
    durationMax: null,
    enzymes: ["amylases and proteases dissolve", "phytase, β-glucanase (slightly)"],
    summary: "hydration",
    flags: ["optional"],
    about: [
      ["Enzymes", "no targeted enzyme activity; amylases and proteases dissolve from the malt into the mash. Phytase and β-glucanase are slightly active at ~35–40 °C."],
      ["Effect", "hydrates the grist, softens the endosperm, prevents dough balls; enzymes are already in solution when the actual rests begin."],
      ["When useful", "coarse crush (e.g. lauter tun systems), poorly modified malts, before decoction, or to slightly increase efficiency. Cold pre-mashing also extracts fewer tannins and husk flavors."],
    ],
  },
  AcidRest: {
    label: "Acid rest / Phytase rest",
    short: "Acid rest",
    range: "30–35 °C (up to 52 °C), typ. ~35 °C",
    tempMin: 30,
    tempMax: 52,
    duration: "30–120 min",
    tempTypical: 35,
    minutes: 30,
    durationMin: 30,
    durationMax: 120,
    enzymes: ["phytase"],
    summary: "phytase, lowers pH",
    flags: ["obsolete"],
    about: [
      ["Enzyme", "phytase."],
      ["Effect", "releases phosphates and lowers mash pH."],
      ["When useful", "practically never today (historically for low-acid malt); pH adjustment is easier with lactic acid or acidulated malt."],
    ],
  },
  BetaGlucanRest: {
    label: "Beta-glucan rest (gum rest)",
    short: "Beta-glucan rest",
    range: "35–45 °C, typ. ~40 °C",
    tempMin: 35,
    tempMax: 45,
    duration: "15–20 min",
    tempTypical: 40,
    minutes: 15,
    durationMin: 15,
    durationMax: 20,
    enzymes: ["β-glucanase"],
    summary: "β-glucanase, viscosity",
    flags: ["optional"],
    about: [
      ["Enzyme", "β-glucanase."],
      ["Effect", "breaks down beta-glucans (gums), lowers viscosity, improves lautering and filterability."],
      ["When useful", "high share of rye, oats, unmalted adjuncts, or poorly modified malts. Rapidly denatured above ~50 °C."],
    ],
  },
  FerulicAcidRest: {
    label: "Ferulic acid rest",
    short: "Ferulic acid rest",
    range: "43–45 °C, typ. ~45 °C",
    tempMin: 43,
    tempMax: 45,
    duration: "15–20 min",
    tempTypical: 45,
    minutes: 15,
    durationMin: 15,
    durationMax: 20,
    enzymes: ["feruloyl esterase"],
    summary: "clove precursor, POF+ yeast",
    flags: ["optional"],
    about: [
      ["Enzyme", "feruloyl esterase."],
      ["Effect", "releases ferulic acid, which phenolic (POF+) yeast converts to 4-vinyl guaiacol (clove aroma)."],
      ["When useful", "wheat beer and other styles with POF+ yeast when more clove character is desired."],
    ],
  },
  ProteinRest: {
    label: "Protein rest (protease rest)",
    short: "Protein rest",
    range: "45–55 °C, typ. ~52 °C",
    tempMin: 45,
    tempMax: 55,
    duration: "10–20 min",
    tempTypical: 52,
    minutes: 10,
    durationMin: 10,
    durationMax: 20,
    enzymes: ["peptidases", "proteinases"],
    summary: "proteinases / peptidases",
    flags: ["optional"],
    about: [
      ["Enzymes", "peptidases (~45–50 °C), proteinases (~50–55 °C)."],
      ["Effect", "lower range produces free amino nitrogen (FAN) as yeast nutrient; upper range breaks down large proteins, reducing haze."],
      ["When useful", "wheat, unmalted adjuncts, poorly modified malts. With modern well-modified malts keep it short or skip it, otherwise foam and body suffer."],
    ],
  },
  MaltoseRest: {
    label: "Maltose rest (beta-amylase rest)",
    short: "Maltose rest",
    range: "60–65 °C, typ. ~63 °C",
    tempMin: 60,
    tempMax: 65,
    duration: "30–60 min",
    tempTypical: 63,
    minutes: 45,
    durationMin: 30,
    durationMax: 60,
    enzymes: ["β-amylase"],
    summary: "β-amylase → maltose, attenuation",
    flags: ["optional"],
    about: [
      ["Enzyme", "β-amylase."],
      ["Effect", "cleaves maltose from starch chains, producing highly fermentable wort, high attenuation, lean and dry beer."],
      ["When useful", "almost always; extend for dry beers (Pils, Saison, Tripel). Heat-sensitive; prefers pH ~5.4 and a thick mash."],
    ],
  },
  CombinedRest: {
    label: "Combined rest (single infusion)",
    short: "Combined rest",
    range: "65–68 °C, typ. ~67 °C",
    tempMin: 65,
    tempMax: 68,
    duration: "60 min",
    tempTypical: 67,
    minutes: 60,
    durationMin: 60,
    durationMax: 60,
    enzymes: ["β-amylase", "α-amylase"],
    summary: "β + α, single infusion",
    flags: ["optional", "conversion"],
    about: [
      ["Enzymes", "β- and α-amylase simultaneously."],
      ["Effect", "compromise between attenuation and body; lower temperature gives a drier beer, higher a fuller one."],
      ["When useful", "simple brewing (infusion, BIAB) with well-modified malts."],
    ],
  },
  SaccharificationRest: {
    label: "Saccharification rest (dextrinization / alpha-amylase rest)",
    short: "Saccharification rest",
    range: "70–75 °C, typ. ~72 °C",
    tempMin: 70,
    tempMax: 75,
    duration: "20–40 min, until iodine-negative",
    tempTypical: 72,
    minutes: 30,
    durationMin: 20,
    durationMax: 40,
    enzymes: ["α-amylase"],
    summary: "α-amylase → dextrins, body",
    flags: ["optional", "conversion"],
    about: [
      ["Enzyme", "α-amylase."],
      ["Effect", "breaks down starch into (unfermentable) dextrins, giving body, mouthfeel, and foam stability."],
      ["When useful", "almost always; extend for full-bodied beers (Bock, Märzen, Stout). Check for complete starch conversion with an iodine test before mash-out."],
    ],
  },
  MashOut: {
    label: "Mash-out",
    short: "Mash-out",
    range: "76–78 °C, typ. ~78 °C",
    tempMin: 76,
    tempMax: 78,
    duration: "Heat up + 5–10 min",
    tempTypical: 78,
    minutes: 10,
    durationMin: 5,
    durationMax: 10,
    enzymes: ["none (inactivation)"],
    summary: "enzyme stop, lautering aid",
    flags: ["always"],
    about: [
      ["Enzymes", "none (inactivation)."],
      ["Effect", "fixes the sugar profile, lowers viscosity for better lautering."],
      ["When useful", "always. Do not exceed 78 °C, otherwise α-amylase is also destroyed and starch dissolved during lautering stays unconverted (starch haze)."],
    ],
  },
};
