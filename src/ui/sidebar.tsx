/**
 * Whether the recipe list (the sidebar) is collapsed, remembered in the browser's local storage (GUI-024, NFR-002).
 * Only a collapsed list is stored; expanding it removes the entry. Without storage (private mode, blocked) the state
 * is simply not remembered.
 */

export const SIDEBAR_KEY = "brewberrypi-editor.sidebar";

export function readSidebarCollapsed(): boolean {
  try {
    return globalThis.localStorage?.getItem(SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) {
      globalThis.localStorage?.setItem(SIDEBAR_KEY, "collapsed");
    } else {
      globalThis.localStorage?.removeItem(SIDEBAR_KEY);
    }
  } catch {
    // not remembered
  }
}

/** Ctrl+B, or ⌘B on a Mac (GUI-024). */
export function isSidebarShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "b";
}

/** The sidebar icon: a panel with a bar on the left, as in Claude Code. */
export function SidebarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" class="size-5 fill-none stroke-current stroke-[1.5]">
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" />
      <path d="M7.75 4v12" />
    </svg>
  );
}
