# Known Limitations, Unverified Items & Technical Notes

This document provides a transparent record of technical constraints, architecture trade-offs, and checks that require verification in the buyer's local/production environment.

## 1. Unverified Items Requiring Local / Production Execution

During Phase 3–5 preparation, the project was audited and tested inside an isolated, offline cloud sandbox VM that had Node.js (`v18.20.4`), Babel (`@babel/core`, `@babel/parser`, `@babel/traverse`), and system ESLint (`v6.4.0`), but **no outbound internet access** and **no pre-installed `bun` binary or `node_modules` directory**.

Consequently, the following items are **verified** vs. **unverified in the sandbox**:

### Verified in the Sandbox
- **AST & TypeScript/JSX Compilation**: All 91 `.ts` and `.tsx` source and test files parsed and compiled cleanly via `@babel/parser` and `@babel/core` (`@babel/preset-typescript` + `@babel/preset-react`) with 0 syntax errors and 0 unused top-level bindings.
- **Automated Unit & Route Tests**: All 39 tests across 9 suites (`src/test/forex-time.test.ts`, `src/test/academy-access.test.ts`, `src/test/sitemap.test.ts`, `src/test/verification.test.ts`, `src/test/app-routing.test.tsx`, `src/test/security-and-edge-cases.test.ts`) executed and passed (`39 / 39 passed`).
- **Static Secret & File Packaging Audit**: Confirmed `.env.example` contains placeholders only, `.gitignore` blocks `.env` and `.env.*` while allowing `!.env.example`, `public/og-image.png` is present, and no `.git` folder or real credentials are included in the ZIP.

### Not Verified in the Offline Sandbox (Must Be Run Locally by Seller/Buyer)
1. **`bun install` / `npm install`**: Must be executed on an internet-connected machine to populate `node_modules`.
2. **Full `tsc --noEmit` & `eslint .` CLI with Project Plugins**: While Babel TypeScript compilation and core ESLint rules passed on all 91 files, running the full `typescript` compiler and `typescript-eslint` + `eslint-plugin-prettier` plugins requires `node_modules` (`bun run lint`).
3. **Full Production Bundle (`bun run build` / `vite build`)**: Requires `node_modules` (`vite`, `@lovable.dev/vite-tanstack-config`, `@tanstack/react-start`, `nitro`) to emit `.output/` / `dist/`.
4. **Live End-to-End Supabase Database & Auth Flow**: Because live `.env` credentials were excluded for security, live signup/login/RLS round-trips against a hosted Supabase instance must be verified after connecting `.env`.

## 2. Architectural & Functional Limitations

1. **Stateless URL-Encoded White-Label Configurations**:
   - White-label academy branding (`brand`, `title`, `logo`, `accent`, `accent2`, `tz`, `fmt`, `sessions`, `labels`, `embed`) is encoded into shareable URL query parameters (`/?brand=...&accent=...`) rather than stored as a separate database table column.
   - **Advantage**: Zero database queries are needed when thousands of students open a shared academy clock link, and students never need to create accounts.
   - **Limitation**: Anyone with a branded URL can see or modify its query parameters in their own browser address bar. Additionally, `public/routes/white-label.tsx` is a public configurator page while `/academy` provides a server-gated branding studio for active academy accounts.
2. **Manual Administrator Payment Verification & Activation**:
   - The application does **not** include automated Stripe, Razorpay, or PayPal webhook billing integration.
   - Academy registrations start in `pending` status (`public.handle_new_user()`), and customization service requests (`$10` Basic / `$25` Advanced on `/white-label`) open a `mailto:` inquiry.
   - Once payment is collected off-platform, the administrator logs into `/academy` and clicks **Activate (30d)** or **Renew (+30d)** in the Administrator Control Panel (`public.admin_set_academy_access`).
3. **Dependency on `@lovable.dev/vite-tanstack-config`**:
   - `vite.config.ts` imports `defineConfig` from `@lovable.dev/vite-tanstack-config` (`2.26.5`), which wraps `@tanstack/react-start`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths`, and `nitro`.
   - If `@lovable.dev/vite-tanstack-config` is ever unavailable on a private registry or if you wish to decouple from Lovable's wrapper in the future, `vite.config.ts` can be replaced with standard `vite` `defineConfig` using the direct plugins already listed in `package.json` (`@tanstack/react-start`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-tsconfig-paths`).
4. **Market Holiday Calendar Not Included**:
   - As disclosed in the UI footer and session guides, the time engine calculates standard weekday (`Monday–Friday`) session hours and weekend closure (`Friday 17:00 NY – Sunday 17:00 NY`) using official IANA timezone rules and DST transitions, but does not track country-specific bank holidays (such as Christmas, New Year's Day, or UK Bank Holidays).
5. **Seller Identifiers Present Until Buyer Cutover**:
   - As documented in `BUYER_HANDOVER.md`, the default contact email (`kondivarun2@gmail.com`), domain (`https://forex-session-compass.lovable.app`), AdSense tag (`ca-pub-4676429472951443`), and Search Console verification tag remain in the code so existing verification tests pass during handover; the buyer should update those 4 values prior to relaunch.
