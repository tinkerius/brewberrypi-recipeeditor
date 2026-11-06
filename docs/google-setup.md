# One-time setup: domain, GitHub Pages and Google

The editor needs a Google Cloud project for "Sign in with Google" and Google Drive, a verified domain, and GitHub
Pages under `recipes.brewberrypi.org`. All values the build needs are public (they identify the app, they grant
nothing), so they are GitHub repository **variables**, not secrets.

Use one Google account as the project's owner, preferably the project's own account (for example the one GitHub uses)
rather than a personal one: its address can appear as the support e-mail on Google's consent screen. Add a second
owner so the project is never locked out.

## 1. DNS

At the DNS provider of `brewberrypi.org`:

| Name | Type | Value |
|---|---|---|
| `recipes` | CNAME | `tinkerius.github.io` |
| `@` (apex) | TXT | the `google-site-verification=…` value from step 3 |

## 2. GitHub Pages

In `tinkerius/brewberrypi-recipeeditor`, **Settings → Pages**:

1. Build and deployment → Source: **GitHub Actions**.
2. Custom domain: `recipes.brewberrypi.org` (`public/CNAME` holds the same name). When the DNS check passes, tick
   **Enforce HTTPS**.

Recommended: in the GitHub *account* settings (Settings → Pages → **Verified domains**) verify `brewberrypi.org`, so
no other GitHub repository can take over its subdomains.

## 3. Domain verification at Google

[Google Search Console](https://search.google.com/search-console) → Add property → **Domain** → `brewberrypi.org`.
Add the TXT record it shows (step 1) and verify. This covers `recipes.brewberrypi.org`. Use the same Google account
as for the Cloud project.

## 4. Google Cloud project

At [console.cloud.google.com](https://console.cloud.google.com):

1. Create a project, e.g. **BrewberryPi**. IAM → add the second owner.
2. APIs & Services → Library: enable **Google Drive API** and **Google Picker API**.
3. **Google Auth Platform**:
   - **Branding**:
     - App name `BrewberryPi` (Google shows it on the consent screen of the editor and of the device's Cloud Sync),
       logo (`brewberrypi/brand/mark-512.png`), user support e-mail.
     - App home page `https://brewberrypi.org`.
     - Privacy policy `https://brewberrypi.org/privacy.html`.
     - Terms of service `https://brewberrypi.org/terms.html`.
     - Authorized domain `brewberrypi.org`.
     - Developer contact e-mail.
   - **Audience**: User type **External**; then **Publish app** (status *In production*). While *Testing*, only listed
     test users can sign in.
   - **Data access**: add the scope `https://www.googleapis.com/auth/drive.file` ("See, edit, create and delete only
     the specific Google Drive files you use with this app"). It is non-sensitive, so no security assessment is
     needed. Google may still review the branding (logo, name) before the logo is shown.
   - **Clients** → Create client → **Web application**, name `recipes.brewberrypi.org`:
     - Authorized JavaScript origins: `https://recipes.brewberrypi.org` and `http://localhost:5173` (development).
     - Authorized redirect URIs: none (the token model uses a pop-up).
     - Note the **client ID**.
4. APIs & Services → **Credentials** → Create credentials → **API key** (for the Picker):
   - Application restrictions: **Websites**: `https://recipes.brewberrypi.org/*` and `http://localhost:5173/*`.
   - API restrictions: **Google Picker API** only.
   - Note the **key**.
5. Project settings (☰ → IAM & Admin → Settings): note the **project number**. The Picker needs it so that picked
   files become available to the editor.

### The BrewberryPi app's Cloud Sync

The app reads the editor's Drive folder through its own OAuth client of type **TVs and Limited Input devices** in
**this same project** (a `drive.file` grant reaches the files of the project, not of one client). Its setup is in
brewberrypi-app `docs/deployment/cloud-sync-google.md`.

## 5. GitHub repository variables

`tinkerius/brewberrypi-recipeeditor` → Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | the OAuth client ID (`….apps.googleusercontent.com`) |
| `GOOGLE_API_KEY` | the Picker API key |
| `GOOGLE_APP_ID` | the project number |

Optional **secret** `UPSTREAM_TOKEN`: only if `brewberrypi-app` or `brewberrypi` are private repositories. It is a
fine-grained token with read access to their contents, used by CI to check the copied files.

Then run *Deploy to GitHub Pages* (Actions tab, or push to `main`).

## 6. Check

1. https://recipes.brewberrypi.org opens over HTTPS.
2. *Sign in with Google* → Google's window shows the app name and asks for access to the app's own Drive files.
3. Afterwards your Drive has the folder `BrewberryPi/recipes`. Save a recipe and the file appears there.
4. Put a `.json` recipe file into that folder at drive.google.com, then *Add files from Drive* → pick it → it is listed.
5. Edit a recipe in two tabs and save both: the second save reports the conflict.

If sign-in fails with `origin_mismatch`, the page's origin is missing from the client's JavaScript origins. If the
picker shows an error, check the API key's website restrictions and that the Picker API is enabled.
