/**
 * "Add untracked file from cloud storage": the Google Picker. With scope drive.file the editor only sees files it created; recipe
 * files the user put into the recipes folder some other way (drive.google.com, Drive for desktop) become visible
 * once they are picked here. The picker needs the API key and the project number (appId) for that.
 */

import { GOOGLE } from "../config";
import { loadScript } from "../auth/loadScript";

const GAPI_SCRIPT = "https://apis.google.com/js/api.js";

async function loadPicker(): Promise<void> {
  await loadScript(GAPI_SCRIPT);
  await new Promise<void>((resolve, reject) =>
    gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Could not load the Google Picker.")) }),
  );
}

/** Opens the picker in the recipes folder; resolves with the picked file ids (empty when cancelled). */
export async function pickRecipeFiles(token: string, recipesFolderId: string): Promise<string[]> {
  await loadPicker();
  return new Promise((resolve) => {
    const inFolder = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes("application/json")
      .setParent(recipesFolderId);
    const anywhere = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes("application/json");
    new google.picker.PickerBuilder()
      .setTitle("Recipe files (.json)")
      .addView(inFolder)
      .addView(anywhere)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE.apiKey)
      .setAppId(GOOGLE.appId)
      .setCallback((response) => {
        if (response.action === google.picker.Action.PICKED) {
          resolve((response.docs ?? []).map((d) => d.id));
        } else if (response.action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build()
      .setVisible(true);
  });
}
