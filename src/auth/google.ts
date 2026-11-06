/**
 * Sign-in with Google (Google Identity Services, token model): the browser gets a short-lived access token for the
 * scope drive.file and no refresh token, so no secret and no backend are needed. The token is kept in memory only;
 * when it expires (after about an hour) it is renewed with prompt "", which normally closes again at once while the
 * Google session lasts. The e-mail address of the last account is remembered in localStorage as a login hint only.
 */

import { DRIVE_SCOPE, GOOGLE } from "../config";
import { loadScript } from "./loadScript";

const GSI_SCRIPT = "https://accounts.google.com/gsi/client";
const HINT_KEY = "brewberrypi.recipeeditor.googleHint";
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

export class GoogleAuth implements TokenSource {
  private client: google.accounts.oauth2.TokenClient | undefined;
  private accessToken: string | undefined;
  private expiresAt = 0;
  private pending: { resolve: (token: string) => void; reject: (error: Error) => void } | undefined;

  constructor(private readonly clientId: string = GOOGLE.clientId) {}

  get signedIn(): boolean {
    return this.accessToken !== undefined;
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
    if (this.accessToken && Date.now() < this.expiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }
    return this.renew();
  }

  renew(): Promise<string> {
    this.accessToken = undefined;
    return this.request("", readHint());
  }

  signOut() {
    const token = this.accessToken;
    this.accessToken = undefined;
    this.expiresAt = 0;
    rememberHint(undefined);
    if (token && typeof google !== "undefined") {
      google.accounts.oauth2.revoke(token);
    }
  }
}
