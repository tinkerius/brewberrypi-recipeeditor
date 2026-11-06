import { describe, expect, it } from "vitest";
import { GoogleAuth, TOKEN_KEY } from "../src/auth/google";

/** A localStorage stand-in. */
function memoryStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

const stored = (expiresInMs: number) => ({ [TOKEN_KEY]: JSON.stringify({ token: "tok", expiresAt: Date.now() + expiresInMs }) });

describe("GoogleAuth, the stored token", () => {
  it("is taken over by a new tab while it is valid, so the tab is signed in without Google's window", async () => {
    const auth = new GoogleAuth("client", memoryStorage(stored(30 * 60_000)));
    expect(auth.hasValidToken()).toBe(true);
    expect(await auth.token()).toBe("tok");
  });

  it("is not used once it is (nearly) expired", () => {
    expect(new GoogleAuth("client", memoryStorage(stored(30_000))).hasValidToken()).toBe(false);
    expect(new GoogleAuth("client", memoryStorage({ [TOKEN_KEY]: "garbage" })).hasValidToken()).toBe(false);
    expect(new GoogleAuth("client", memoryStorage()).hasValidToken()).toBe(false);
  });

  it("follows a token another tab renewed", () => {
    const storage = memoryStorage();
    const auth = new GoogleAuth("client", storage);
    expect(auth.hasValidToken()).toBe(false);
    storage.setItem(TOKEN_KEY, JSON.stringify({ token: "new", expiresAt: Date.now() + 3_600_000 }));
    expect(auth.hasValidToken()).toBe(true);
  });

  it("is removed on sign-out, which other tabs see", () => {
    const storage = memoryStorage(stored(30 * 60_000));
    const auth = new GoogleAuth("client", storage);
    auth.signOut();
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
    expect(auth.hasValidToken()).toBe(false);
  });

  it("stays when only this tab forgets it, and goes when it no longer works", () => {
    const storage = memoryStorage(stored(30 * 60_000));
    const auth = new GoogleAuth("client", storage);
    auth.forget();
    expect(storage.getItem(TOKEN_KEY)).not.toBeNull();
    auth.forget(true);
    expect(storage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("works without storage (blocked): memory only", () => {
    expect(new GoogleAuth("client", undefined).hasValidToken()).toBe(false);
  });
});
