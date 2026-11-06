/** The parts of Google's browser libraries this editor uses (accounts.google.com/gsi/client, apis.google.com/js/api.js). */

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number | string;
    scope: string;
    error?: string;
    error_description?: string;
  }
  interface ClientConfigError {
    type: "popup_failed_to_open" | "popup_closed" | "unknown";
    message?: string;
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: "" | "none" | "consent" | "select_account"; login_hint?: string }): void;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: ClientConfigError) => void;
    login_hint?: string;
  }): TokenClient;
  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
  function revoke(token: string, done?: () => void): void;
}

declare namespace google.picker {
  const Action: { PICKED: string; CANCEL: string };
  const Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
  const ViewId: { DOCS: string };
  interface PickedDoc {
    id: string;
    name: string;
    mimeType: string;
    parentId?: string;
  }
  interface ResponseObject {
    action: string;
    docs?: PickedDoc[];
  }
  class DocsView {
    constructor(viewId?: string);
    setMimeTypes(types: string): DocsView;
    setParent(folderId: string): DocsView;
    setIncludeFolders(include: boolean): DocsView;
    setMode(mode: string): DocsView;
  }
  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    enableFeature(feature: string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setCallback(callback: (response: ResponseObject) => void): PickerBuilder;
    build(): { setVisible(visible: boolean): void };
  }
}

declare namespace gapi {
  function load(api: string, options: { callback: () => void; onerror?: () => void }): void;
}
