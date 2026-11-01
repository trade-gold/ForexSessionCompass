# Third-Party Packages, Assets & Licensing Information

## 1. Application Source Code License

Upon completion of the commercial sale and handover, ownership and usage rights for the custom **Forex Session Compass** application source code (`src/`, `supabase/migrations/`, `public/`, and accompanying documentation) transfer to the buyer according to the purchase agreement.

## 2. Third-Party Open-Source Dependencies (`package.json`)

All third-party libraries used by **Forex Session Compass** are standard open-source packages distributed via the npm registry. Below is the inventory of dependencies declared in `package.json` and their standard upstream licenses:

### Runtime Dependencies (`dependencies`)

| Package | Version | Standard Upstream License | Purpose |
| :--- | :--- | :--- | :--- |
| `react` & `react-dom` | `^19.2.0` | MIT | Core UI component library |
| `@tanstack/react-router` | `1.170.41` | MIT | File-based client & SSR routing |
| `@tanstack/react-start` | `1.168.60` | MIT | Full-stack SSR framework & server middleware |
| `@tanstack/router-plugin` | `1.168.42` | MIT | Route tree code generation plugin |
| `@tanstack/react-query` | `^5.101.1` | MIT | Async state & query management |
| `@supabase/supabase-js` | `^2.118.0` | MIT | Supabase Auth, PostgreSQL & RPC client |
| `tailwindcss` & `@tailwindcss/vite` | `^4.2.1` | MIT | Utility-first CSS framework |
| `@radix-ui/react-*` (27 packages) | `^1.x` / `^2.x` | MIT | Accessible headless UI primitives (shadcn/ui base) |
| `lucide-react` | `^0.575.0` | ISC | UI icons |
| `zod` | `^3.25.76` | MIT | Runtime schema & input validation |
| `react-hook-form` & `@hookform/resolvers` | `^7.71.2` / `^5.2.2` | MIT | Form state & validation integration |
| `date-fns` | `^4.1.0` | MIT | Date utility library |
| `class-variance-authority` | `^0.7.1` | Apache-2.0 | Component variant styling |
| `clsx` & `tailwind-merge` | `^2.1.1` / `^3.5.0` | MIT | Class name merging utilities |
| `cmdk`, `sonner`, `vaul`, `input-otp` | `^1.x` / `^2.x` | MIT | Command menu, toast, drawer, OTP primitives |
| `embla-carousel-react` | `^8.6.0` | MIT | Carousel component |
| `recharts` | `^2.15.4` | MIT | Chart primitives |
| `react-day-picker` | `^9.14.0` | MIT | Calendar picker primitive |
| `react-resizable-panels` | `^4.6.5` | MIT | Resizable layout panels |
| `tw-animate-css` | `^1.3.4` | MIT | CSS animation utilities |
| `vite-tsconfig-paths` | `^6.0.2` | MIT | TypeScript path alias resolution |

### Development & Build Dependencies (`devDependencies`)

| Package | Version | Standard Upstream License | Purpose |
| :--- | :--- | :--- | :--- |
| `typescript` | `^5.8.3` | Apache-2.0 | TypeScript compiler & language service |
| `vite` | `8.1.5` | MIT | Frontend build tool & dev server |
| `@vitejs/plugin-react` | `^5.2.0` | MIT | React plugin for Vite |
| `nitro` | `3.0.260603-beta` | MIT | Universal SSR server engine |
| `vitest` | `^4.1.10` | MIT | Unit and integration test runner |
| `@testing-library/react` & `jest-dom` | `^16.0.0` / `^6.6.0` | MIT | DOM & React component testing utilities |
| `jsdom` | `^20.0.3` | MIT | DOM environment for Node test runner |
| `eslint`, `@eslint/js`, `typescript-eslint` | `^9.32.0` / `^8.56.1` | MIT | Static code linting |
| `prettier` & `eslint-plugin-prettier` | `^3.7.3` / `^5.2.6` | MIT | Code formatting |
| `@lovable.dev/vite-tanstack-config` | `2.26.5` | Proprietary / Lovable | Vite + TanStack Start + Nitro configuration wrapper |

## 3. Fonts & Visual Assets

- **Typography**:
  - **IBM Plex Sans** (Google Fonts) — Licensed under the **SIL Open Font License 1.1 (OFL-1.1)**.
  - **JetBrains Mono** (Google Fonts) — Licensed under the **SIL Open Font License 1.1 (OFL-1.1)**.
- **Static Public Assets (`public/`)**:
  - `public/favicon.ico`: First-party application icon.
  - `public/og-image.png`: First-party generated 1200×630 Open Graph preview image created specifically for Forex Session Compass.
  - Zero copyrighted third-party photos, stock illustrations, or proprietary logos are bundled in the repository.
