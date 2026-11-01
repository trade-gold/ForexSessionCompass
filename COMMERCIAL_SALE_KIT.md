# Forex Session Compass — Commercial Sale, Demo & Flippa Listing Kit

> **Target Asking Price**: **$1,000 USD** *(Seller's asking price target for the turnkey software application, source code, database schema, and documentation package. Sold as a pre-revenue software product with no claims of historical revenue, active paying subscribers, or verified traffic metrics.)*

---

## PART 1 — PROFESSIONAL PRODUCT PRESENTATION (TASK 3)

### Executive Overview
**Forex Session Compass** (branded in the default interface as **Forex Time Tools**) is a turnkey, B2C and B2B2C fintech utility web application built with **TanStack Start, React 19, TypeScript, Tailwind CSS v4, and Supabase**.

It solves two high-frequency problems in the retail and educational forex market:
1. **For Individual Forex Traders (B2C Public Utility)**: Eliminates timezone and Daylight Saving Time (DST) calculation errors across the **Sydney**, **Tokyo**, **London**, and **New York** trading sessions using browser-native IANA timezone calculations (`Australia/Sydney`, `Asia/Tokyo`, `Europe/London`, `America/New_York`).
2. **For Forex Trading Academies, Discord Communities & Mentors (B2B White-Label & Academy Rental Portal)**: Provides a customizable white-label session dashboard and embeddable widget system, paired with a Supabase-authenticated **User Profile, Academy Rental, and Administrator Portal** where the site owner can activate and manage 30-day academy access accounts.

### Confirmed Product Capabilities (Verified in Source Code)

| Feature Category | Confirmed Capabilities in Source Code |
| :--- | :--- |
| **Live 4-Session Clock (`/`)** | Real-time clocks, `OPEN` / `CLOSED` badges, `DST` active badges, local & user-zone trading hours, live countdowns (`Closes in` / `Opens in`), session progress bars, and a 24-hour UTC timeline with a live time cursor for Sydney, Tokyo, London, and New York. |
| **DST & Weekend Intelligence** | Automatically handles US (`EST`/`EDT`), UK (`GMT`/`BST`), and Australian (`AEST`/`AEDT`) DST shifts, highlights the March/October US–UK DST gap where the London–New York overlap expands to 5 hours (`300m`), and displays a weekend closure banner with an exact reopen countdown (`Sunday 17:00 America/New_York`). |
| **Multi-Timezone Desk & Profiles** | Pin up to 6 world clocks simultaneously from 12 major financial centers (`IST`, `UTC`, `London`, `New York`, `Tokyo`, `Sydney`, `Frankfurt`, `Dubai`, `Singapore`, `Hong Kong`, `Chicago`, `Los Angeles`), toggle persistent `12H`/`24H` formatting, and save up to 8 named timezone profiles in browser storage. |
| **Time Zone Converter (`/converter`)** | Converts any date and time between 12 financial zones with strict leap-year/calendar validation, `⇄ Swap zones`, live session open/closed badges for the converted timestamp, and a 12-zone comparison table. |
| **Session Overlap Calculator (`/overlap`)** | Computes exact London ∩ New York and custom pair overlaps on any UTC date, renders a 24-hour overlap visualization bar chart, and flags 5-hour US/UK DST mismatch dates. |
| **UTC to Local Converter (`/utc-to-local`)** | Side-by-side live UTC and local clocks with persistent preferred timezone selection and a specific UTC `datetime-local` timestamp converter. |
| **Educational Session Guides (`/sessions/*`)** | Index page (`/sessions`) plus 4 dedicated session pages (`/sessions/sydney`, `/sessions/tokyo`, `/sessions/london`, `/sessions/newyork`) detailing trading hours, live countdowns, typical session traits, associated currency pairs, and DST rules. |
| **White-Label Studio & Embeds (`/white-label`)** | Customizes community name, browser title, logo monogram/HTTPS image, primary & secondary hex colors, default timezone, 12H/24H mode, visible sessions, and custom session labels (e.g., Killzones). Outputs shareable student URLs (no student login required), responsive `<iframe>` embeds (`embed=1` compact mode), downloadable HTML wrappers, and JSON configs, plus 3 demo academy presets and $10 / $25 service pricing cards. |
| **User Profile Dashboard (`/academy`, `/profile`)** | 7-section fintech SaaS dashboard (**Overview**, **My Profile**, **Membership**, **Subscription Details**, **Preferences**, **Security**, **Account Management**) with Supabase Auth login/registration, display name & contact editing, verified email update flow, password change/reset, and persistent clock preferences. |
| **Academy Rental & Admin Console** | PostgreSQL RLS + `get_my_academy_access()` server-clock expiry enforcement (`is_active`), plus an **Admin Console** (visible only when `public.is_admin()` returns `true`) with one-click **Activate (30d)**, **Renew (+30d)**, and **Deactivate** controls (`public.admin_set_academy_access`). |

---

## PART 2 — INTERACTIVE DEMO INSPECTION & SALES MATERIAL (TASK 4)

### Inspection of the Standalone Interactive Demo (`forex-session-compass-preview.html`)
Alongside the main TanStack Start application source code, a standalone, single-file interactive demonstration (`forex-session-compass-preview.html`) was inspected separately:
- **Separation from Main Codebase**: The standalone HTML demo is kept separate from the production source tree (`forex-session-compass-main/`) so it does not pollute the TanStack Start application routes or build output.
- **What the Interactive Demo Showcases**: It allows prospective buyers to interactively test the live IANA session clock, 12H/24H toggle, weekday overlap simulation, multi-timezone desk clocks, saved profiles, converter, overlap calculator, UTC-to-local tool, white-label preset switcher (`Apex Pip Academy`, `Mumbai FX Academy`, `Meridian Macro`), and a role switcher (`Active Academy`, `Pending Academy`, `Expired Academy`, `Administrator`) without needing to spin up a local Node/Supabase environment first.

### Suggested Screenshots to Capture for Your Listing
Capture these 6 screenshots at `1440×900` (desktop) and `390×844` (mobile) for your Flippa listing and outreach deck:
1. **Main Session Clock Dashboard (`/`)**: With "Simulate Active Weekday Overlap" toggled ON so London and New York both display glowing `OPEN` badges, progress bars, and the `Active overlap: London ∩ New York` banner above the 24-hour timeline and Multi-Timezone Desk Clocks.
2. **Branded White-Label Academy View (`/?brand=Apex+Pip+Academy...`)**: Showing the amber/sky `Apex Pip Academy (Demo)` theme, `DEMO ACADEMY BRANDING` header bar, 12H clock mode, and custom `London Killzone` / `NY Killzone` cards.
3. **White-Label Configurator & Pricing (`/white-label`)**: Showing the side-by-side Brand Configuration form, live embedded clock preview, generated student URL / iframe snippet, and the `$10` Basic / `$25` Advanced customization service cards.
4. **Session Overlap Calculator (`/overlap`)**: Showing a date during the US/UK DST transition window (e.g., `2026-10-28` or `2026-03-18`) highlighting the 5-hour (`300m`) London ∩ New York overlap and 24-hour overlap bar chart.
5. **User Profile Dashboard (`/academy` — Overview & Membership Tabs)**: Showing the dark navy sidebar with all 7 sections (`Overview`, `My Profile`, `Membership`, `Subscription`, `Preferences`, `Security`, `Account Management`) and the `Active` membership badge.
6. **Administrator Control Panel (`/academy` — Admin Console Tab)**: Showing the registered academies table with `Activate (30d)`, `Renew (+30d)`, and `Deactivate` action buttons.

### Buyer Demonstration Checklist (Live Walkthrough Script)
When demonstrating the software to a prospective buyer on a video call or screen recording:
- [ ] **Step 1 (Core Clock & DST Engine)**: Open `/`, switch the timezone dropdown between `IST (India) — Asia/Kolkata`, `London — Europe/London`, and `New York — America/New_York`, toggle `24H` / `12H`, and toggle `Simulate Active Weekday Overlap`.
- [ ] **Step 2 (Multi-Timezone Clocks & Profiles)**: Pin `Asia/Tokyo` to the Multi-Timezone Desk Clocks, save a profile named `"London-NY Desk"`, refresh the browser, and show that preferences persist.
- [ ] **Step 3 (Converter & Overlaps)**: Open `/converter` and swap zones; open `/overlap` and select `2026-03-18` to demonstrate automatic US/UK 5-hour DST gap detection.
- [ ] **Step 4 (White-Label Studio)**: Open `/white-label`, click **Apex Pip Academy demo** and **Mumbai FX Academy (Demo)**, copy the generated student URL, and open it with `&embed=1` to show the compact LMS/Notion widget mode.
- [ ] **Step 5 (User Profile & Admin Portal)**: Log into `/academy`, click through the 7 sidebar sections (`Overview`, `My Profile`, `Membership`, `Subscription`, `Preferences`, `Security`, `Account Management`), and demonstrate the **Admin Console** activating and renewing an academy account for 30 days.

### Short Product Pitch for Direct Outreach (Cold Email / DM to Trading Educators & Micro-PE Buyers)

> **Subject**: Turnkey Forex Session Clock + White-Label Academy SaaS (React 19 / TanStack / Supabase) — $1,000 USD
>
> Hi [Name],
>
> I'm selling full ownership of **Forex Session Compass** (`https://forex-session-compass.lovable.app`), a complete, DST-accurate forex session clock and white-label academy platform built with React 19, TanStack Start, TypeScript, Tailwind CSS, and Supabase.
>
> Beyond the public trader tools (live Sydney/Tokyo/London/NY clocks, timezone converter, overlap calculator, and session guides), it includes a complete **White-Label Configurator** and a **Supabase-backed Academy Rental & User Profile Dashboard**. Trading educators and Discord/Telegram communities can customize their own branded session clock (custom logo badge, colors, Killzone labels, default timezone, and LMS iframe embed) while you manage 30-day academy activations from a built-in Administrator Console.
>
> The package includes the complete source code, 3 Supabase SQL migrations with Row-Level Security, 39 automated Vitest tests, and 8 buyer handover documents. Asking price is **$1,000 USD** for a clean asset sale.
>
> Would you like me to send over the interactive demo and technical overview?

---

## PART 3 — COMMERCIAL FLIPPA & DIRECT BUYER LISTING DRAFT (TASK 6)

### Listing Title
**Forex Session Compass — Turnkey Forex Session Clock & White-Label Academy SaaS (React 19, TypeScript, Supabase)**

### Short Headline (Listing Subtitle)
Complete B2C/B2B forex session timing web app with an IANA DST engine, white-label embed studio for trading academies, and a 7-section Supabase User & Admin Dashboard. Asking $1,000 USD.

### Sale Type & Financial Disclosure
- **Asset Type**: Turnkey Software Application / Starter SaaS Codebase & Database Package
- **Asking Price**: **$1,000 USD**
- **Revenue / Traffic Status**: Pre-revenue starter software product. No historical revenue, profit, active paying subscribers, or verified traffic claims are made. Priced strictly on engineering, architecture, security hardening, and documentation value.

### Full Flippa Product Description

#### Overview
**Forex Session Compass** (branded in the default UI as **Forex Time Tools**) is a modern, commercially structured web application built for two complementary audiences in the retail forex ecosystem:
1. **Individual Forex Traders (Organic Search & Utility Traffic)**: Traders worldwide need a reliable way to track when the **Sydney, Tokyo, London, and New York** sessions open, close, and overlap in their local timezone—especially during the weeks in March, April, October, and November when the US, UK, and Australia shift Daylight Saving Time (DST) on different dates.
2. **Forex Trading Academies, Discord Communities & Mentors (B2B Monetization Engine)**: Educators can use the built-in **White-Label Studio** and **Academy Rental Portal** to configure a branded session clock with their academy name, custom theme colors, custom session labels (such as *"London Killzone"* or *"Asian Range"*), default student timezone, shareable student URL (no student login required), and compact `<iframe>` widget for Notion, Discord, or course portals.

#### Built-In Monetization Pathways Ready for the New Owner
- **AdSense Ready**: Pre-wired global head metadata structure for Google AdSense across 14 SEO-optimized public pages with canonical URLs, Open Graph cards (`1200×630`), Twitter metadata, `sitemap.xml`, and `robots.txt`.
- **One-Time White-Label Customization Packages ($10 Basic / $25 Advanced)**: Built-in service tier showcase on `/white-label` allowing communities to request branded clock configurations and standalone HTML embed wrappers.
- **30-Day Recurring Academy Rental System (`/academy`)**: Built-in Supabase authentication, PostgreSQL Row-Level Security, and an **Administrator Control Panel** where you can activate, renew (+30 days), or suspend academy accounts with a single click, enforced by the PostgreSQL server clock (`public.get_my_academy_access()`).

#### Complete Feature List
- **DST-Aware IANA Forex Time Engine**: Calculates Sydney (`Australia/Sydney`), Tokyo (`Asia/Tokyo`), London (`Europe/London`), and New York (`America/New_York`) hours dynamically via `Intl.DateTimeFormat`, including US/UK 5-hour overlap gap alerts and weekend reopen countdowns.
- **Main Session Clock Dashboard (`/`)**: 4 session status cards, `OPEN`/`CLOSED` and `DST` badges, progress bars, 24-hour UTC timeline bar, weekday overlap simulation toggle, Multi-Timezone Desk Clocks (pin up to 6 financial centers), and Saved Timezone Profiles.
- **Forex Time Zone Converter (`/converter`)**: Converts dates and times across 12 major global zones with session open/closed indicators at the target timestamp.
- **Session Overlap Calculator (`/overlap`)**: Computes exact session overlaps for any UTC date with a 24-hour visual overlap bar chart.
- **UTC to Local Converter (`/utc-to-local`)**: Live side-by-side UTC and local clocks plus specific timestamp conversion.
- **Educational Session Guides (`/sessions`, `/sessions/sydney`, `/sessions/tokyo`, `/sessions/london`, `/sessions/newyork`)**: Plain-language guides covering hours, typical characteristics, currency pairs, and DST rules.
- **White-Label Configurator (`/white-label`)**: Live brand editor, 3 demo academy presets, 5 terminal color palettes, shareable URL generator, HTML-escaped `<iframe>` embed generator, downloadable HTML wrapper, and JSON exporter.
- **7-Section User Profile Dashboard (`/academy`, `/profile`)**: Dark fintech SaaS sidebar with **Overview**, **My Profile** (display name, contact info, verified email change), **Membership** (plan status, features matrix, white-label studio), **Subscription Details**, **Preferences** (persistent timezone & 12H/24H clock format), **Security** (password update & reset email), and **Account Management**.
- **Administrator Console**: Server-protected (`public.is_admin()`) table to view, filter, search, activate (30d), renew (+30d), and deactivate registered academies.

#### Technology Stack
- **Frontend & SSR Framework**: TanStack Start (`1.168.60`), TanStack Router (`1.170.41`), React 19 (`19.2.0`), TypeScript (`5.8.3`)
- **Styling & UI**: Tailwind CSS v4 (`4.2.1`), Radix UI primitives, Lucide React icons
- **Server & Bundler**: Vite (`8.1.5`), Nitro SSR (`3.0.260603-beta`), `@lovable.dev/vite-tanstack-config` (`2.26.5`)
- **Database & Auth**: Supabase (`@supabase/supabase-js` `2.118.0`), PostgreSQL with Row-Level Security (RLS) and RPC functions
- **Testing**: Vitest (`4.1.10`) with 6 test files (39 unit, routing, SEO, and security assertions)

#### Included Assets in the Sale
1. Complete, clean application source code archive (`forex-session-compass-updated.zip`).
2. All 3 chronological Supabase PostgreSQL migration files (`supabase/migrations/`).
3. Public static assets including `public/og-image.png`, `public/favicon.ico`, `public/sitemap.xml`, and `public/robots.txt`.
4. Standalone interactive HTML product preview (`forex-session-compass-preview.html`) for client demos.
5. 8 comprehensive handover and operations manuals (`README.md`, `INSTALLATION.md`, `DEPLOYMENT.md`, `SUPABASE_SETUP.md`, `FEATURES.md`, `BUYER_HANDOVER.md`, `KNOWN_LIMITATIONS.md`, `LICENSES.md`).

#### Technical Requirements to Operate
- **Hosting ($0/mo Free Tier Compatible)**: Any Nitro SSR-compatible host such as **Cloudflare Pages/Workers**, **Lovable**, **Vercel**, or **Netlify**.
- **Database ($0/mo Free Tier Compatible)**: A free-tier **Supabase** project (requires setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).

#### Known Limitations (Disclosed Upfront)
- **Manual Payment Verification**: Academy activations (`Activate 30d` / `Renew +30d`) are triggered by the administrator in the Admin Console after collecting payment via your preferred payment link/invoice; automated Stripe/PayPal webhooks are not pre-wired.
- **URL-Based White-Label Sharing**: Shared student dashboard links encode branding parameters in the URL query string so students can access them immediately without creating accounts or consuming database reads.
- **Bank Holidays**: Standard weekday session hours and DST rules are calculated automatically; country-specific public bank holidays are not tracked.

#### Handover & Post-Sale Support Terms
- Instant delivery of the complete source code ZIP, SQL migrations, and documentation suite upon escrow/payment completion.
- Step-by-step instructions included in `BUYER_HANDOVER.md` showing the exact lines to replace with your domain, contact email, Supabase keys, and AdSense/Search Console tags.
