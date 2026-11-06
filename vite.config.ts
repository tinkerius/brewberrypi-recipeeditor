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

export default defineConfig({
  plugins: [preact(), tailwindcss(), contentSecurityPolicy()],
  // Served at the root of https://recipes.brewberrypi.org.
  base: "/",
  // The Google OAuth client allows the origin http://localhost:5173 for development.
  server: { host: "localhost", port: 5173, strictPort: true },
  preview: { host: "localhost", port: 5173, strictPort: true },
  test: { environment: "node" },
});
