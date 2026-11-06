/** Notices: where signed-out drafts are kept (and how they get lost), errors and progress. */

import type { BrowserStorageKind } from "../store/BrowserStore";

export const BROWSER_STORAGE_WARNING =
  "Cloud Sync is off — your recipes are only stored in this browser and can be lost: when browser data is cleared, " +
  "in a private window, or in Safari after 7 days without a visit. Download each recipe, or turn on Cloud Sync " +
  "(Sign in with Google) to keep them in your Google Drive.";

export const MEMORY_STORAGE_WARNING =
  "Cloud Sync is off, and this browser does not let the page store anything: your recipes are only kept in this tab " +
  "and are lost when you close or reload it. Download each recipe, or turn on Cloud Sync (Sign in with Google) to " +
  "keep them in your Google Drive.";

export function StorageBanner(props: { kind: BrowserStorageKind }) {
  return (
    <div
      role="note"
      class="rounded-xl border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-ink dark:border-brass-light/30 dark:bg-brass-light/10 dark:text-ink-light"
    >
      <strong class="font-semibold">⚠ </strong>
      {props.kind === "memory" ? MEMORY_STORAGE_WARNING : BROWSER_STORAGE_WARNING}
    </div>
  );
}

export function ErrorBanner(props: { message: string; onClose: () => void }) {
  return (
    <div
      role="alert"
      class="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30"
    >
      <span class="flex-1 whitespace-pre-line">{props.message}</span>
      <button type="button" class="font-medium underline" onClick={props.onClose}>
        Dismiss
      </button>
    </div>
  );
}

export function InfoBanner(props: { message: string; onClose: () => void }) {
  return (
    <div
      role="status"
      class="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm text-ink ring-1 ring-stone-200 dark:bg-surface-dark dark:text-ink-light dark:ring-white/10"
    >
      <span class="flex-1">{props.message}</span>
      <button type="button" class="font-medium underline" onClick={props.onClose}>
        OK
      </button>
    </div>
  );
}
