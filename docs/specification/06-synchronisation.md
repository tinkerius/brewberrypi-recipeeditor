# 06 — Synchronisation (signed in)

The same Drive folder can change while the editor is open: the editor in another tab or on another device,
drive.google.com, Drive for desktop. (The BrewberryPi app's Cloud Sync only reads the folder, `QE-03`.) Drive sends change notifications only to a
server (a webhook); the editor has none (`SCO-003`), so it asks Drive.

- `SYN-001` The recipe list is read after sign-in and kept current without any action of the user; there is no
  reload button (product owner, 2026-11-06).
- `SYN-002` While the page is visible, the editor asks Drive's changes feed every **10 s**, and when the page comes
  back into view (at most every 5 s). Only a change that concerns a listed recipe (edited, renamed, trashed, moved
  away) or a file in the recipes folder reads the list again; the whole list is also read every **5 minutes**. A
  position in the feed that Drive no longer accepts starts the feed again and counts as a change.
- `SYN-003` Reading the list again merges it with the recipes; unsaved changes are never thrown away:
  - a new file appears in the list and is read (`DRV-005`);
  - a recipe not read yet follows a rename at once and is read;
  - a recipe that was read and has no pending changes is read again when it changed in Google Drive, whether it is
    open or not, so its row shows the new name (`QE-31`; an edit made while it is read wins);
  - a recipe with pending changes is left as it is; the check on save decides (`DRV-007`);
  - a recipe deleted or moved away is dropped from the list, with the notice "Deleted or moved in your Google
    Drive: …"; one with pending changes stays as a recipe not saved yet, saying so, so Save creates it again;
  - recipes not saved yet stay.
- `SYN-004` Synchronisation runs only while the token is valid and never opens Google's window; errors are not
  shown, the next check tries again.
