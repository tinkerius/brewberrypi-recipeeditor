# 04 — Browser Drafts (signed out)

- `BRW-001` Signed out, every recipe is a **draft** kept in the browser's own storage on this device (IndexedDB),
  saved automatically shortly after each change, so a reload, a closed tab or a crash keeps it.
- `BRW-002` The editor asks the browser to keep this storage (persistent storage). If the browser offers no
  storage at all (e.g. some private windows), drafts are kept only in the tab's memory.
- `BRW-003` This storage is **not safe**, and the editor MUST say so in a banner that is always visible while signed
  out:
  - storage available: "Not signed in — your recipes are only stored in this browser and can be lost: when browser
    data is cleared, in a private window, or in Safari after 7 days without a visit. Download each recipe, or sign
    in with Google to keep them in your Google Drive."
  - memory only: "Not signed in, and this browser does not let the page store anything: your recipes are only kept
    in this tab and are lost when you close or reload it. Download each recipe, or sign in with Google to keep them
    in your Google Drive."
- `BRW-004` A draft changed since its last download (or never downloaded) is marked **not downloaded** in the list
  and the editor ("Not downloaded yet" / "Changed since download"); after a download, "Downloaded".
- `BRW-005` Leaving the page asks first while a draft has pending changes and the storage is memory only or failed.
- `BRW-006` **Delete all recipes in this browser** deletes every draft after asking; downloaded files are not
  affected.
- `BRW-007` If storing a draft fails, the editor says so and asks to download the recipe.
- `BRW-008` Drafts stay in the browser while signed in (not shown) and are shown again after sign-out, except those
  saved to Drive (`DRV-012`).
