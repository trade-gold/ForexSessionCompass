# Forex Session Compass (Forex Time Tools)

Forex Session Compass (branded in the default UI as **Forex Time Tools**) is a web application for foreign exchange traders, trading educators, and mentorship communities. It provides real-time, daylight-saving-aware market session clocks for Sydney, Tokyo, London, and New York, timezone and overlap calculators, a URL-driven white-label customization studio, and a Supabase-backed User Profile, Academy Rental, and Administrator dashboard.

- **Current Reference Deployment**: `https://forex-session-compass.lovable.app`
- **Package Type**: Turnkey Web Application Source Code & Database Schema Package

## Key Capabilities

1. **Live Forex Market Session Clock (`/`)**
   - Real-time clocks and open/closed indicators for Sydney (`Australia/Sydney`), Tokyo (`Asia/Tokyo`), London (`Europe/London`), and New York (`America/New_York`).
   - Built on the browser's native `Intl.DateTimeFormat` IANA timezone database rather than fixed UTC schedules.
   - Automatic Daylight Saving Time (DST) badges, US/UK transitional 5-hour overlap detection, weekend closure detection with reopen countdown, 24-hour UTC timeline bar, simulated weekday overlap mode, multi-timezone desk clocks (up to 6 pinned zones), and browser-persisted timezone profiles.
2. **Forex Time Zone Converter (`/converter`)**
   - Converts any calendar date and time between 12 major financial timezones (including IST `Asia/Kolkata`, `UTC`, London, New York, Tokyo, Sydney, Frankfurt, Dubai, Singapore, Hong Kong, Chicago, and Los Angeles) and displays which sessions are open at that instant.
3. **Session Overlap Calculator (`/overlap`)**
   - Calculates exact overlap windows (such as London ∩ New York and Tokyo ∩ London) for any selected UTC date, shown in the user's chosen timezone, accompanied by a 24-hour overlap visualization bar.
4. **UTC to Local Converter (`/utc-to-local`)**
   - Displays a live UTC clock beside the user's preferred local timezone and converts specific `datetime-local` UTC timestamps.
5. **Educational Session Guides (`/sessions`, `/sessions/$session`)**
   - Individual reference guides for `/sessions/sydney`, `/sessions/tokyo`, `/sessions/london`, and `/sessions/newyork` with live status, UTC hours, countdowns, commonly associated currency pairs, and DST notes.
6. **White-Label Configurator & Embed Generator (`/white-label`)**
   - Allows trading academies and communities to customize community name, browser title, monogram/HTTPS logo, primary and secondary theme colors, default timezone, 12H/24H clock format, displayed sessions, and custom session labels (e.g., Killzones).
   - Generates shareable student URLs (requiring no student login), responsive `<iframe>` embed snippets, compact headerless embed views (`embed=1`), downloadable HTML wrapper files, and JSON configurations.
   - Includes a built-in pricing showcase ($10 Basic Branding and $25 Advanced Customization & Embed Widget tiers) and 3 fictional demo presets.
7. **User Profile, Academy Rental & Administrator Dashboard (`/academy`, `/profile`)**
   - Supabase-authenticated account portal featuring 7 user sections (**Overview**, **My Profile**, **Membership**, **Subscription Details**, **Preferences**, **Security**, **Account Management**) plus a server-gated **Administrator Control Panel** (`public.is_admin()`) for activating, renewing (+30 days), or deactivating academy accounts.

## Technology Stack

- **Framework**: TanStack Start (`@tanstack/react-start` 1.168.60) & TanStack Router (`@tanstack/react-router` 1.170.41)
- **Frontend UI**: React 19 (`19.2.0`), TypeScript (`5.8.3`), Tailwind CSS v4 (`4.2.1`), Radix UI primitives, Lucide React icons
- **Build & SSR Server**: Vite (`8.1.5`), Nitro (`3.0.260603-beta`), `@lovable.dev/vite-tanstack-config` (`2.26.5`)
- **Backend & Auth**: Supabase (`@supabase/supabase-js` `2.118.0`, PostgreSQL with Row-Level Security and RPC functions)
- **Validation & Testing**: Zod (`3.25.76`), React Hook Form (`7.71.2`), Vitest (`4.1.10`), Testing Library

## Documentation Index

| Document | Contents |
| :--- | :--- |
| [`INSTALLATION.md`](./INSTALLATION.md) | Prerequisites, dependency installation, `.env` configuration, and local development commands. |
| [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) | Database schema, SQL migrations, Row-Level Security policies, auth URL configuration, and administrator bootstrap steps. |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | SSR/Nitro runtime requirements, hosting options (Lovable, Cloudflare, Vercel, Netlify, Node), and post-deploy checks. |
| [`FEATURES.md`](./FEATURES.md) | Detailed inventory of all implemented routes, components, and calculations verified in the source code. |
| [`BUYER_HANDOVER.md`](./BUYER_HANDOVER.md) | Ownership transfer checklist and exact file locations for replacing seller-specific identifiers (domain, email, AdSense, Search Console). |
| [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md) | Known technical constraints, unverified offline sandbox checks, and architecture notes. |
| [`LICENSES.md`](./LICENSES.md) | Third-party open-source package and font licenses. |
| [`COMMERCIAL_SALE_KIT.md`](./COMMERCIAL_SALE_KIT.md) | Product presentation, sales pitch, demo guide, and Flippa listing copy. |

## Quick Start

```sh
# 1. Copy environment variable template and add your public Supabase URL and anon key
cp .env.example .env

# 2. Install dependencies (Bun or npm)
bun install
# or: npm install

# 3. Run automated tests
bun run test
# or: npm test

# 4. Start local development server
bun run dev
# or: npm run dev

# 5. Build for production
bun run build
# or: npm run build
```
