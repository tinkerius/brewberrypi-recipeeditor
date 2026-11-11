/// <reference types="vitest/config" />
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

/**
 * Content-Security-Policy for the built page (not the dev server, whose hot reload needs more). Only the page
 * itself and Google: sign-in (accounts.google.com), the Drive API (www.googleapis.com) and the file picker
 * (apis.google.com, docs.google.com).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: https://*.googleusercontent.com https://*.gstatic.com",
  "font-src 'self'",
  "connect-src 'self' https://www.googleapis.com https://content.googleapis.com https://accounts.google.com https://oauth2.googleapis.com",
  "frame-src https://accounts.google.com https://docs.google.com https://drive.google.com https://content.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
    ],
  };
}

/** Set automatically inside a GitHub Codespace. */
const inCodespace = process.env.CODESPACES === "true";

export default defineConfig({
  plugins: [preact(), tailwindcss(), contentSecurityPolicy()],
  // Served at the root of https://recipes.brewberrypi.org.
  base: "/",
  // The Google OAuth client allows the origin http://localhost:5173 for development.
  // In a GitHub Codespace the page is served via https://<codespace>-5173.app.github.dev, so allow that host
  // and send hot reload over the forwarded HTTPS port (443) instead of 5173.
  // Listen on 127.0.0.1, not "localhost": Node resolves "localhost" to IPv6 ::1 only, which the Codespaces port
  // forwarder (IPv4) cannot reach. The browser still opens http://localhost:5173 locally, so the OAuth origin is
  // unchanged.
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: [".app.github.dev"],
    ...(inCodespace && { hmr: { clientPort: 443 } }),
  },
  preview: { host: "127.0.0.1", port: 5173, strictPort: true, allowedHosts: [".app.github.dev"] },
  // Only this repository's tests (CI checks out the upstream repositories in .upstream/).
  // Google is "configured" in the tests (a fake client id), so the signed-in paths can be tested.
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"], env: { VITE_GOOGLE_CLIENT_ID: "test-client" } },
});