# Installation & Local Configuration Guide

This guide walks a developer or new owner through setting up **Forex Session Compass** from the delivery ZIP archive on Windows, macOS, or Linux.

## 1. System Prerequisites

- **Node.js**: v20.x LTS or v22.x LTS recommended (minimum v18.20+)
- **Package Manager**: **Bun** (v1.1+ recommended, matching the included `bun.lock` and `bunfig.toml`) or **npm** (v9+)
- **Git**: v2.30+ (for initializing or connecting your version control repository)
- **Supabase Account**: Free-tier or Pro Supabase project (optional if running only public forex tools; required for `/login`, `/register`, `/academy`, and `/profile` account features)

## 2. Extracting the Package & Initializing Git

The delivery ZIP intentionally excludes any `.git` folder so you start with a clean repository history and no inherited commit noise.

### Option A: Initialize a Brand-New Git Repository (New Buyer)

```sh
unzip forex-session-compass-updated.zip
cd forex-session-compass-main

git init -b main
git add -A
git commit -m "chore: initial import of Forex Session Compass"

# Connect to your own GitHub / GitLab / Bitbucket repository:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Option B: Apply to an Existing Repository Clone

If you already have a local clone of the project repository, copy the contents of `forex-session-compass-main/` into your existing working folder (preserving your local `.git/` directory and `.env` file), then commit and push.

## 3. Installing Dependencies

Using **Bun** (recommended, uses `bun.lock`):

```sh
bun install
```

Or using **npm**:

```sh
npm install
```

> **Note on `@lovable.dev/vite-tanstack-config`**: The project uses `@lovable.dev/vite-tanstack-config` (`2.26.5`) in `devDependencies` to bundle TanStack Start, Vite React, Tailwind CSS v4, tsconfig paths, and Nitro SSR in `vite.config.ts`. Ensure your machine has internet access to the npm registry during installation.

## 4. Environment Variable Configuration

1. Copy the provided `.env.example` template to `.env` in the project root:
   ```sh
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*
2. Open `.env` in your code editor and replace the placeholder values with your Supabase project's public URL and anonymous key:
   ```dotenv
   VITE_SUPABASE_URL=https://your-actual-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-public-key
   ```
3. **Graceful Degradation Without `.env`**:
   - If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are omitted, `src/lib/supabase.ts` exports `supabase = null`.
   - All public forex tools (`/`, `/converter`, `/overlap`, `/utc-to-local`, `/sessions/*`, `/white-label`, `/about`, `/contact`, `/privacy`, `/disclaimer`) continue to run normally.
   - Authentication pages (`/login`, `/register`) display a clean service-unavailable notice (`src/components/ServiceUnavailable.tsx`) instead of crashing.
4. **Security Rule**:
   - Never place your Supabase `service_role` secret key or database password in `.env` or any `VITE_*` variable, as `VITE_*` variables are embedded into the client browser bundle.
   - `.gitignore` is pre-configured to ignore `.env` and `.env.*` while allowing `.env.example`.

## 5. Available Project Scripts

Defined in `package.json`:

| Script | Bun Command | npm Command | Description |
| :--- | :--- | :--- | :--- |
| `dev` | `bun run dev` | `npm run dev` | Starts the local Vite + TanStack Start development server with HMR. |
| `build` | `bun run build` | `npm run build` | Builds the production client and Nitro SSR bundle (`vite build`). |
| `build:dev` | `bun run build:dev` | `npm run build:dev` | Runs a development-mode build (`vite build --mode development`). |
| `preview` | `bun run preview` | `npm run preview` | Previews the production build locally (`vite preview`). |
| `test` | `bun run test` | `npm test` | Executes all automated test suites once (`vitest run`). |
| `test:watch` | `bun run test:watch` | `npm run test:watch` | Runs Vitest in interactive watch mode (`vitest`). |
| `lint` | `bun run lint` | `npm run lint` | Runs ESLint across the codebase (`eslint .`). |
| `format` | `bun run format` | `npm run format` | Formats files with Prettier (`prettier --write .`). |

## 6. Verifying Your Local Setup

After installing dependencies and configuring `.env`, run:

```sh
bun run lint
bun run test
bun run build
```

Confirm that all 6 test files in `src/test/` pass and `vite build` completes without errors before deploying.
