/**
 * Google settings, set at build time (GitHub repository variables → VITE_* in .github/workflows/pages.yml; locally
 * in .env.local). All three are public values: they identify the app, they don't grant access to anything.
 */
export const GOOGLE = {
  /** OAuth web client id (Google Auth Platform → Clients). */
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  /** Browser API key restricted to the Picker API and this site's referrers. */
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? "",
  /** Cloud project number; the picker needs it so picked files are shared with this app (scope drive.file). */
  appId: import.meta.env.VITE_GOOGLE_APP_ID ?? "",
};

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function googleConfigured(): boolean {
  return GOOGLE.clientId !== "";
}

export function pickerConfigured(): boolean {
  return googleConfigured() && GOOGLE.apiKey !== "" && GOOGLE.appId !== "";
}
