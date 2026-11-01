# Buyer Handover & Ownership Transfer Guide

This document provides everything a new owner needs to take full operational control of **Forex Session Compass**, replace seller-specific identifiers, configure their own infrastructure, and verify the application.

## 1. What Is Included in the Delivery Package

- **Complete Application Source Code**: All TypeScript/React routes (`src/routes/`), components (`src/components/`), core libraries (`src/lib/`), hooks (`src/hooks/`), styles (`src/styles.css`), and automated Vitest suites (`src/test/`).
- **Database Schema & Security Migrations**: All 3 PostgreSQL / Supabase migrations in `supabase/migrations/`.
- **Public & SEO Assets**: `public/favicon.ico`, `public/og-image.png` (1200×630 Open Graph card), `public/sitemap.xml`, and `public/robots.txt`.
- **Configuration & Lockfiles**: `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `components.json`, `.prettierrc`, `.prettierignore`, `.gitignore`, and `.env.example`.
- **Complete Documentation Suite**: `README.md`, `INSTALLATION.md`, `DEPLOYMENT.md`, `SUPABASE_SETUP.md`, `FEATURES.md`, `BUYER_HANDOVER.md`, `KNOWN_LIMITATIONS.md`, `LICENSES.md`, and `COMMERCIAL_SALE_KIT.md`.

## 2. Seller-Specific Identifiers to Replace After Purchase

To ensure existing automated verification tests (`src/test/verification.test.ts` and `src/test/sitemap.test.ts`) pass out of the box during handover inspection, the current seller's domain, contact email, and verification meta tags remain intact in the source code.

Once you verify the package, update the following exact locations with your own details:

| Identifier Type | Current Value in Source Code | Exact File(s) & Location to Update |
| :--- | :--- | :--- |
| **Contact & Inquiry Email** | `kondivarun2@gmail.com` | 1. `src/routes/contact.tsx` (line 13: `const EMAIL = "kondivarun2@gmail.com";`)<br>2. `src/routes/white-label.tsx` (line 287: `mailto:kondivarun2@gmail.com`) |
| **Production Domain / Origin** | `https://forex-session-compass.lovable.app` | 1. `src/components/site.tsx` (line 8: `export const SITE_ORIGIN = ...`)<br>2. `src/lib/white-label.ts` (line 216: default `origin` in `brandedURL`)<br>3. `public/sitemap.xml` (lines 3–16)<br>4. `public/robots.txt` (line 16)<br>5. `src/test/sitemap.test.ts` (line 4) & `src/test/verification.test.ts` |
| **Google AdSense Account Tag** | `ca-pub-4676429472951443` | 1. `src/routes/__root.tsx` (line 87: `{ name: "google-adsense-account", content: "..." }`)<br>2. `src/test/verification.test.ts` (line 23) |
| **Google Search Console Tag** | `5YFSCOqTK9qZ-F_0rdTj3OY8YkALbLS4GhJZXYPhhaM` | 1. `src/routes/index.tsx` (line 13: `{ name: "google-site-verification", content: "..." }`)<br>2. `src/test/verification.test.ts` (line 33) |
| **Lovable Project Reference** | `f35b8a88-0ac3-53d9-b9cc-5056b51b24f1` | `.lovable/project.json` (only used if importing into Lovable; can be replaced or removed if hosting on Cloudflare/Vercel/Netlify) |

## 3. Step-by-Step Ownership & Transfer Checklist

### Step 1: Source Code & Git Repository Transfer
- [ ] Extract the delivery ZIP on your machine.
- [ ] Initialize a new Git repository (`git init -b main && git add -A && git commit -m "Initial commit"`) and push to your own private GitHub/GitLab repository, **or** accept a direct GitHub repository transfer from the seller (`Algnino/forex-session-compass`) if agreed in the sale terms.
- [ ] Verify that seller collaborator access on the transferred GitHub repository is removed once transfer completes.

### Step 2: Supabase Project & Database Setup
- [ ] Create a new Supabase project in your own Supabase organization (recommended for clean billing and credential isolation) **or** accept a Supabase project transfer from the seller.
- [ ] If using a new Supabase project, run the 3 SQL migration files in `supabase/migrations/` in chronological order (`20261031101444_...`, `20261031101511_...`, `20261031102101_...`) via the Supabase SQL Editor (see `SUPABASE_SETUP.md`).
- [ ] If taking transfer of an existing Supabase project, rotate the database password, review all rows in `public.admins` and `auth.users`, and remove any seller user UUIDs from `public.admins`.

### Step 3: Environment Variables Replacement
- [ ] Copy `.env.example` to `.env` locally and populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your own Supabase project (`Project Settings → API`).
- [ ] Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your production hosting dashboard.
- [ ] Confirm that no seller `.env` files or credentials exist in your environment.

### Step 4: Administrator Bootstrap & Verification
- [ ] Start the app (`bun run dev` or on your staging URL) and register your owner account at `/register`.
- [ ] Insert your new account's `auth.users` UUID into `public.admins`:
  ```sql
  INSERT INTO public.admins (user_id) VALUES ('<your-user-uuid>') ON CONFLICT DO NOTHING;
  ```
- [ ] Log in at `/login`, navigate to `/academy`, open the **Admin Console** section in the sidebar, and verify that you can activate, renew (+30 days), and deactivate an academy account.

### Step 5: Hosting & Domain Cutover
- [ ] Update the seller-specific email, domain, AdSense, and Search Console tags listed in Section 2 above.
- [ ] Run `bun install && bun run lint && bun run test && bun run build` locally to confirm all tests and the production build pass after your branding edits.
- [ ] Deploy to your chosen SSR-compatible host (Lovable, Cloudflare Pages/Workers, Vercel, or Netlify — see `DEPLOYMENT.md`).

## 4. Items That Cannot Be Transferred Automatically Inside a ZIP Archive

For transparency, the following external accounts and services exist outside the source code archive and must either be created fresh by the buyer (recommended, $0 free tier available) or transferred separately via account invitations:

1. **Supabase Cloud Project**: Database hosting and authentication service (buyer can create a free-tier Supabase project in 3 minutes and run the 3 included SQL migrations).
2. **Hosting Account / `.lovable.app` Subdomain**: The live subdomain `forex-session-compass.lovable.app` is tied to the seller's Lovable project unless the Lovable project is transferred or the buyer deploys to their own Cloudflare/Vercel/Netlify/Lovable account and custom domain.
3. **Google AdSense & Google Search Console Properties**: AdSense publisher accounts (`ca-pub-...`) and Search Console verifications are personal to each site owner; the buyer must substitute their own tags in `src/routes/__root.tsx` and `src/routes/index.tsx`.
4. **Private npm / Build Dependencies Notice**: `@lovable.dev/vite-tanstack-config` (`2.26.5`) is referenced in `package.json` and `vite.config.ts` (see `KNOWN_LIMITATIONS.md` for details on how to keep or replace it with standard Vite plugins if desired).
