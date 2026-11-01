# Production Deployment Guide

This document details the runtime requirements, build pipeline, environment variables, and hosting configurations for deploying **Forex Session Compass** to production.

## 1. Architecture & Runtime Requirements (Critical)

**Forex Session Compass is a Server-Side Rendered (SSR) TanStack Start + Nitro application, not a static-only single-page application (SPA).**

- **Server Entry**: `vite.config.ts` uses `@lovable.dev/vite-tanstack-config` with `tanstackStart: { server: { entry: "server" } }`, which compiles `src/server.ts` (`fetch(request, env, ctx)`) and `src/start.ts` (CSRF protection and SSR error middleware) via **Nitro** (`"nitro": "3.0.260603-beta"`).
- **Route Mode**: `src/routeTree.gen.ts` registers `ssr: true`.
- **Implication for Hosting**: You must deploy the application to a hosting platform that supports **Nitro SSR / Edge / Server runtimes** (such as Lovable Cloud, Cloudflare Pages/Workers, Vercel, Netlify, or a Node.js server). Do not upload the output to a static-only file host (such as basic Amazon S3 or GitHub Pages) unless you reconfigure TanStack Start for static pre-rendering.

## 2. Required Production Environment Variables

Configure the following environment variable names in your hosting provider's build and runtime settings:

| Variable Name | Required | Value Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Yes (for Auth/Academy) | Your Supabase project URL (`https://<project-ref>.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Yes (for Auth/Academy) | Your Supabase public anonymous (`anon`) JWT key. |

> **Security Warning**: Never configure `SUPABASE_SERVICE_ROLE_KEY` or any private database credentials under a `VITE_` prefix.

## 3. Hosting Options & Step-by-Step Deployment

### Option A: Lovable Hosting (Native Default)

The project is pre-configured for Lovable's build pipeline via `@lovable.dev/vite-tanstack-config` and `.lovable/project.json`.

1. Connect the GitHub repository to your Lovable project.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in project settings.
3. Click **Publish** in the Lovable editor (or push to `main` on the connected GitHub repository).
4. Optional: Attach a custom domain in the Lovable domain settings (HTTPS is provisioned automatically).

### Option B: Cloudflare Pages / Workers (Default Nitro Target)

`@lovable.dev/vite-tanstack-config` configures Nitro with `cloudflare` as its default build target.

1. In the Cloudflare Dashboard, go to **Workers & Pages → Create Application → Pages → Connect to Git**.
2. Select your repository.
3. Configure build settings:
   - **Framework preset**: None / Custom
   - **Build command**: `bun run build` (or `npm run build`)
   - **Build output directory**: `.output/public` (or `dist` depending on preset output)
4. Under **Settings → Environment variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Trigger a deployment and attach your custom domain under **Custom domains**.

### Option C: Vercel

1. Import your Git repository in the Vercel Dashboard.
2. Configure build settings:
   - **Build Command**: `bun run build` (or `npm run build`)
   - **Environment Variables**:
     - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
     - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
     - `NITRO_PRESET` = `vercel`
3. Deploy and configure your custom domain under **Settings → Domains**.

### Option D: Netlify

1. Import your Git repository in Netlify.
2. Set **Build command** to `bun run build` (or `npm run build`).
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `NITRO_PRESET` = `netlify`
4. Deploy and attach your custom domain.

## 4. Changing the Production Domain Name

If you deploy to a custom domain other than `https://forex-session-compass.lovable.app`, update the canonical domain constant in the following files before building:

1. `src/components/site.tsx` (line 8):
   - Update `export const SITE_ORIGIN = "https://forex-session-compass.lovable.app";` to your new domain (no trailing slash).
2. `src/lib/white-label.ts` (line 216):
   - Update the default `origin` parameter in `brandedURL(config, origin = "https://forex-session-compass.lovable.app")`.
3. `public/sitemap.xml`:
   - Replace `https://forex-session-compass.lovable.app` across all 14 `<loc>` entries with your new domain.
4. `public/robots.txt`:
   - Update `Sitemap: https://forex-session-compass.lovable.app/sitemap.xml` to your new domain.
5. `src/test/sitemap.test.ts` and `src/test/verification.test.ts`:
   - Update the expected domain constant if you change `public/sitemap.xml`.

## 5. Post-Deployment Verification Checklist

After deploying to production, verify the following in a live browser:

1. **HTTPS & Security**: Confirm SSL certificate validity and confirm via browser DevTools (`Sources` / `Network`) that only the public `anon` key is present.
2. **Public Routes & SEO**:
   - Visit `/`, `/converter`, `/overlap`, `/utc-to-local`, `/sessions`, `/sessions/sydney`, `/sessions/tokyo`, `/sessions/london`, `/sessions/newyork`, `/white-label`, `/about`, `/contact`, `/privacy`, and `/disclaimer`.
   - Inspect page source (`Ctrl+U`) to verify `<link rel="canonical">`, `og:title`, `og:description`, `og:image` (`/og-image.png`), `og:url`, and `twitter:card` tags.
   - Visit `/sitemap.xml` and `/robots.txt` directly.
3. **Authentication & Dashboard**:
   - Register a new test account at `/register` and log in at `/login`.
   - Confirm redirect to `/academy` and test all 7 dashboard tabs (`Overview`, `My Profile`, `Membership`, `Subscription`, `Preferences`, `Security`, `Account Management`) and `/profile`.
4. **Administrator Console**:
   - Log in with an account listed in `public.admins` and verify the **Admin Console** tab appears on `/academy` and can activate, renew, and deactivate academy rows.
