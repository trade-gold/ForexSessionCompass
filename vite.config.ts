// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Public (publishable) Lovable Cloud settings. .gitignore excludes .env, so published
// builds would otherwise ship without a backend connection and crash on load.
// These values are safe to expose in browser code; never add secret keys here.
const PUBLIC_BACKEND_FALLBACK = {
  VITE_SUPABASE_URL: "https://c--948d554e-bc94-4bb7-9e93-3a64105876a6-prod.lovable.cloud",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_vyW2QtLCOo6LoJsaWG-l_Q_AxZW9a5x",
  VITE_SUPABASE_PROJECT_ID: "ckrhfqcntmvxwyrztlay",
} as const;

const fileEnv = loadEnv(process.env["NODE_ENV"] === "production" ? "production" : "development", process.cwd(), "VITE_");

const define = Object.fromEntries(
  Object.entries(PUBLIC_BACKEND_FALLBACK).map(([key, fallback]) => [
    `import.meta.env.${key}`,
    JSON.stringify(process.env[key] || fileEnv[key] || fallback),
  ]),
);

export default defineConfig({
  vite: { define },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
