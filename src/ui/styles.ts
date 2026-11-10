/** Shared Tailwind class lists in the BrewberryPi brand colours (styles.css), as on the website brewberrypi.org (QE-27). */

const BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-light " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export const BUTTON_STYLES = {
  /** The website's .btn--primary: pink with dark text, in light and dark mode. */
  primary: `${BUTTON} bg-berry-light text-ink hover:enabled:bg-berry-light-hover`,
  /** The website's .btn--ghost: outlined; the outline turns to the text colour on hover. */
  secondary:
    `${BUTTON} text-ink ring-1 ring-line-2 ring-inset hover:enabled:ring-ink ` +
    "dark:text-ink-light dark:ring-white/20 dark:hover:enabled:ring-ink-light",
  /** An outlined button on the dark top bar (the website's .btn--ghost.btn--sm in its nav). */
  onDark: `${BUTTON} px-3 py-1.5 text-ink-light ring-1 ring-white/20 ring-inset hover:enabled:ring-ink-light`,
  danger:
    `${BUTTON} bg-white text-red-600 ring-1 ring-red-300 ring-inset hover:enabled:bg-red-50 ` +
    "dark:bg-white/10 dark:text-red-400 dark:ring-red-400/40 dark:hover:enabled:bg-red-500/10",
  dangerSolid: `${BUTTON} bg-red-600 text-white hover:enabled:bg-red-500`,
  /** Small icon-like buttons on a goal (move, remove). */
  small:
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-stone-600 ring-1 ring-stone-300 ring-inset " +
    "hover:enabled:bg-stone-100 disabled:opacity-30 dark:text-stone-300 dark:ring-white/10 dark:hover:enabled:bg-white/10",
} as const;

/**
 * Rare actions as a link, like the links on brewberrypi.org (site/styles.css `.link`): text with the berry underline.
 */
export const LINK_STYLE =
  "text-left text-sm font-semibold text-ink underline decoration-berry-light decoration-2 underline-offset-4 " +
  "hover:enabled:decoration-berry-light-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-light " +
  "disabled:cursor-not-allowed disabled:opacity-40 dark:text-ink-light";

export const INPUT_STYLE =
  "w-full rounded-md bg-white px-3 py-2 text-sm text-ink ring-1 ring-line-2 ring-inset " +
  "placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-berry-light " +
  "dark:bg-white/10 dark:text-ink-light dark:ring-white/10 dark:focus-visible:outline-berry-light";

export const INVALID_INPUT = "ring-red-400 dark:ring-red-400/60";

/** A value worth a second look, but valid (EDT-033). */
export const WARN_INPUT = "ring-2! ring-amber-500! dark:ring-brass-light!";

export const SELECT_STYLE =
  "rounded-md bg-white px-3 py-2 text-sm font-medium text-ink ring-1 ring-line-2 ring-inset " +
  "focus-visible:outline-2 focus-visible:outline-berry-light disabled:cursor-not-allowed disabled:opacity-40 " +
  "dark:bg-white/10 dark:text-ink-light dark:ring-white/10 dark:focus-visible:outline-berry-light";

/** White cards with a thin border, as the website's cards. */
export const CARD_STYLE = "rounded-lg bg-white p-4 ring-1 ring-line sm:p-6 dark:bg-surface-dark dark:ring-white/10";

/** Card and dialog titles: Zilla Slab Bold, as the website's headings. */
export const TITLE_STYLE = "font-brand text-xl font-bold leading-tight text-ink dark:text-ink-light";

/** Section headings inside a tab (the Mashing tab's "Temperature Ladder" and "Rests"): one size smaller. */
export const SECTION_TITLE_STYLE = "font-brand text-lg font-bold leading-tight text-ink dark:text-ink-light";

export const LABEL_STYLE = "block text-xs font-medium text-stone-600 dark:text-stone-300";

export const HINT_STYLE = "text-xs text-stone-500 dark:text-stone-400";
