/**
 * Sign-in with Google (Google Identity Services, token model): the browser gets a short-lived access token for the
 * scope drive.file and no refresh token, so no secret and no backend are needed. The token is kept in localStorage
 * until it expires (about an hour) or the user signs out, so other tabs and reloads of the editor are signed in too;
 * signing out in one tab signs out all of them (App listens for the storage event). An expired token is renewed with
 * prompt "", which needs a click (it opens Google's window, which normally closes again at once while the Google
 * session lasts). The e-mail address of the last account is remembered in localStorage as a login hint.
 */

import { DRIVE_SCOPE, GOOGLE } from "../config";
import { loadScript } from "./loadScript";

const GSI_SCRIPT = "https://accounts.google.com/gsi/client";
const HINT_KEY = "brewberrypi.recipeeditor.googleHint";
export const TOKEN_KEY = "brewberrypi.recipeeditor.googleToken";
/** Renew this long before the token expires. */
const EXPIRY_MARGIN_MS = 60_000;

export class SignInError extends Error {}

export interface TokenSource {
  /** A valid access token; renews it if needed. */
  token(): Promise<string>;
  /** A new access token (after the API answered 401). */
  renew(): Promise<string>;
}

function readHint(): string | undefined {
  try {
    return localStorage.getItem(HINT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function rememberHint(email: string | undefined) {
  try {
    if (email) {
      localStorage.setItem(HINT_KEY, email);
    } else {
      localStorage.removeItem(HINT_KEY);
    }
  } catch {
    // Storage blocked: the hint is only a convenience.
  }
}

interface StoredToken {
  token: string;
  expiresAt: number;
}

function readStoredToken(storage: Storage | undefined): StoredToken | undefined {
  try {
    const stored = JSON.parse(storage?.getItem(TOKEN_KEY) ?? "null") as StoredToken | null;
    return stored && typeof stored.token === "string" && typeof stored.expiresAt === "number" ? stored : undefined;
  } catch {
    return undefined;
  }
}

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // blocked: the token stays in this tab's memory
  }
}

export class GoogleAuth implements TokenSource {
  private client: google.accounts.oauth2.TokenClient | undefined;
  private accessToken: string | undefined;
  private expiresAt = 0;
  private pending: { resolve: (token: string) => void; reject: (error: Error) => void } | undefined;

  constructor(
    private readonly clientId: string = GOOGLE.clientId,
    private readonly storage: Storage | undefined = defaultStorage(),
  ) {
    this.adoptStoredToken();
  }

  get signedIn(): boolean {
    return this.accessToken !== undefined;
  }

  /** True while the token is valid, so a request needs no renewal (which may open Google's window). */
  hasValidToken(): boolean {
    if (!(this.accessToken !== undefined && Date.now() < this.expiresAt - EXPIRY_MARGIN_MS)) {
      this.adoptStoredToken(); // another tab may have renewed it
    }
    return this.accessToken !== undefined && Date.now() < this.expiresAt - EXPIRY_MARGIN_MS;
  }

  /** Takes over a still valid token another tab (or an earlier visit) stored. */
  private adoptStoredToken() {
    const stored = readStoredToken(this.storage);
    if (stored && Date.now() < stored.expiresAt - EXPIRY_MARGIN_MS && stored.expiresAt > this.expiresAt) {
      this.accessToken = stored.token;
      this.expiresAt = stored.expiresAt;
    }
  }

  private storeToken() {
    try {
      if (this.accessToken) {
        this.storage?.setItem(TOKEN_KEY, JSON.stringify({ token: this.accessToken, expiresAt: this.expiresAt }));
      } else {
        this.storage?.removeItem(TOKEN_KEY);
      }
    } catch {
      // blocked or full: the token stays in this tab's memory
    }
  }

  private async tokenClient(): Promise<google.accounts.oauth2.TokenClient> {
    if (!this.client) {
      await loadScript(GSI_SCRIPT);
      this.client = google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => this.onToken(response),
        error_callback: (error) =>
          this.settle(
            new SignInError(
              error.type === "popup_failed_to_open"
                ? "The Google sign-in window was blocked. Allow pop-ups for this site and try again."
                : "Google sign-in was cancelled.",
            ),
          ),
      });
    }
    return this.client;
  }

  private onToken(response: google.accounts.oauth2.TokenResponse) {
    if (response.error) {
      this.settle(new SignInError(response.error_description ?? `Google sign-in failed (${response.error}).`));
    } else if (!google.accounts.oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
      this.settle(
        new SignInError("The editor needs access to its own files in your Google Drive. Sign in again and allow it."),
      );
    } else {
      this.accessToken = response.access_token;
      this.expiresAt = Date.now() + Number(response.expires_in) * 1000;
      this.storeToken();
      this.settle(undefined, response.access_token);
    }
  }

  private settle(error: Error | undefined, token?: string) {
    const pending = this.pending;
    this.pending = undefined;
    if (error) {
      pending?.reject(error);
    } else if (token) {
      pending?.resolve(token);
    }
  }

  private async request(prompt: "" | "select_account", hint?: string): Promise<string> {
    const client = await this.tokenClient();
    this.pending?.reject(new SignInError("Superseded by a new sign-in."));
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      client.requestAccessToken({ prompt, login_hint: hint });
    });
  }

  /** Interactive sign-in (call from a click: it opens Google's window). */
  signIn(): Promise<string> {
    const hint = readHint();
    return this.request(hint ? "" : "select_account", hint);
  }

  /** Sign in with another Google account. */
  switchAccount(): Promise<string> {
    return this.request("select_account");
  }

  async token(): Promise<string> {
    if (this.hasValidToken() && this.accessToken) {
      return this.accessToken;
    }
    return this.renew();
  }

  renew(): Promise<string> {
    this.accessToken = undefined;
    this.expiresAt = 0;
    return this.request("", readHint());
  }

  /** Signs out in every tab: the stored token is removed (other tabs see it go) and revoked at Google. */
  signOut() {
    const token = this.accessToken;
    this.forget();
    this.storeToken();
    rememberHint(undefined);
    if (token) {
      // After a reload the Google script may not be loaded yet.
      void loadScript(GSI_SCRIPT)
        .then(() => google.accounts.oauth2.revoke(token))
        .catch(() => undefined);
    }
  }

  /** Drops the token in this tab; discard also removes the stored one (it no longer works). */
  forget(discard = false) {
    this.accessToken = undefined;
    this.expiresAt = 0;
    if (discard) {
      this.storeToken();
    }
  }
}
