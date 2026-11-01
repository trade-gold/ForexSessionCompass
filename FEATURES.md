# Implemented Features Inventory

Every feature listed in this document is verified to exist in the current **Forex Session Compass** source code (`src/` and `supabase/migrations/`). No unimplemented or hypothetical features are listed.

## 1. Core Forex Time & Session Engine (`src/lib/forex-time.ts`)

- **Official IANA Timezone Calculations**: Uses browser-native `Intl.DateTimeFormat` with official IANA identifiers rather than fixed UTC schedules:
  - **Sydney Session**: `07:00–16:00 Australia/Sydney` (AEST `UTC+10` / AEDT `UTC+11`)
  - **Tokyo Session**: `09:00–18:00 Asia/Tokyo` (JST `UTC+09`, no DST)
  - **London Session**: `08:00–17:00 Europe/London` (GMT `UTC+00` / BST `UTC+01`)
  - **New York Session**: `08:00–17:00 America/New_York` (EST `UTC-05` / EDT `UTC-04`)
- **Daylight Saving Time (DST) Handling**:
  - Two-pass wall-clock-to-UTC solver (`zonedTimeToUtc`) accurately resolves spring-forward and fall-back transitions.
  - `isDstActive(date, tz)` detects whether any city is currently observing DST.
  - `isUsUkDstGap(date)` detects the transitional weeks in March and October/November when the US and UK switch DST on different Sundays (expanding the London–New York overlap from 4 hours to 5 hours / 300 minutes).
- **Weekend Closure & Market Week Transitions**:
  - `isForexWeekendClosed(now)` identifies the institutional weekend break (Friday `17:00 America/New_York` through Sunday `17:00 America/New_York`).
  - `getMarketWeekTransition(now)` calculates the exact UTC instant when the market next reopens (Sunday `17:00 NY`) or closes (Friday `17:00 NY`).
- **Calendar & Timezone Input Validation**:
  - `isValidZone(tz)` safely validates IANA timezone identifiers.
  - `isValidCalendarDate(y, m, d)` rejects impossible calendar dates (such as `2026-02-30` or `2026-02-29` in a non-leap year) without rolling over into the next month.
  - `sessionInterval` supports both standard intra-day sessions and overnight midnight-crossing sessions (`closeHour <= openHour`).

## 2. Public Forex Tools & Pages

### A. Main Session Clock Dashboard (`src/routes/index.tsx` & `src/components/SessionClock.tsx`)
- **Primary Clock Panel**: Displays live time in the user's selected timezone (`viewTz`), formatted date, UTC offset (`UTC+05:30`, etc.), and current UTC clock.
- **12-Hour / 24-Hour Format Toggle (`FormatToggle`)**: Switches all clocks and session windows between `24H` and `12H` formats and persists the choice in `localStorage` (`fsc_fmt`).
- **Four Session Cards (Sydney, Tokyo, London, New York)**:
  - Live `OPEN` / `CLOSED` status badge with animated pulse dot (`live-dot`).
  - `DST` badge when a financial center is actively observing daylight saving time.
  - Live local clock in the session's own timezone.
  - Session opening and closing hours in both the session's local zone and the user's selected zone.
  - Live countdown (`Closes in` / `Opens in`) to the next session transition.
  - Visual progress bar (`role="progressbar"`) for open sessions and direct link to each session's guide page.
- **24-Hour UTC Timeline Bar**: Displays today's trading intervals for all displayed sessions alongside a live current-time cursor.
- **Simulate Active Weekday Overlap Mode**: Checkbox that previews a live Wednesday London ∩ New York overlap window with a prominent `SIMULATION` banner so users can inspect overlap behavior even on weekends.
- **Multi-Timezone Desk Clocks**: Allows users to pin up to 6 financial centers from 12 built-in zones (`UTC`, `Asia/Kolkata`, `Europe/London`, `America/New_York`, `Asia/Tokyo`, `Australia/Sydney`, `Europe/Berlin`, `Asia/Dubai`, `Asia/Singapore`, `Asia/Hong_Kong`, `America/Chicago`, `America/Los_Angeles`) with `localStorage` persistence (`fsc_pinned_zones`).
- **Saved Timezone Profiles**: Allows users to save, apply, and delete up to 8 named timezone/format/clock setups in `localStorage` (`fsc_saved_profiles_v1`).
- **One-Click Share View Button**: Copies a shareable URL preserving the current timezone, clock format, and branding parameters.

### B. Forex Time Zone Converter (`src/routes/converter.tsx`)
- Converts any selected date and time from one timezone to another (`From zone` → `To zone`) with a one-click `⇄ Swap zones` button.
- Displays the converted time, date, UTC offset, DST status, open/closed badges for all 4 sessions at that exact instant, and an equivalent time table across all 12 global zones.

### C. Session Overlap Calculator (`src/routes/overlap.tsx`)
- Calculates the exact London ∩ New York overlap window for any selected UTC date in the user's chosen timezone.
- Displays a custom two-session comparator (`Compare two sessions`), a 24-hour visual overlap bar chart, a complete 6-pair overlap summary table, and a US/UK DST Transition Gap notice on dates where the London–New York overlap spans 5 hours.

### D. UTC to Local Time Converter (`src/routes/utc-to-local.tsx`)
- Displays live side-by-side UTC and local clocks, saves the user's preferred timezone (`ftt-zone`), and converts specific `datetime-local` UTC timestamps.

### E. Session Information Guides (`src/routes/sessions.index.tsx` & `src/routes/sessions.$session.tsx`)
- Overview page (`/sessions`) and individual session guides (`/sessions/sydney`, `/sessions/tokyo`, `/sessions/london`, `/sessions/newyork`) showing live local time, `OPEN`/`CLOSED` status, today's UTC hours, countdown timer, typical characteristics, commonly associated pairs, and DST rules.

### F. Informational & Legal Pages (`src/routes/about.tsx`, `contact.tsx`, `privacy.tsx`, `disclaimer.tsx`)
- Dedicated About, Contact (`mailto:` form with trimmed input validation), Privacy Policy, and Educational Disclaimer pages.

## 3. White-Label Customization & Embed System (`src/lib/white-label.ts`, `src/components/BrandProvider.tsx`, `src/routes/white-label.tsx`)

- **URL-Driven Reusable Brand Configuration**:
  - `brand`: Custom academy or community name (up to 100 chars).
  - `title`: Custom browser `<title>` (up to 160 chars).
  - `logo`: Validated `https://` image URL or safe alphanumeric monogram badge (`1–12` chars).
  - `accent`: Primary hex theme color (`#rrggbb`), applied to `--primary`, `--up`, and `--ring` CSS variables.
  - `accent2`: Secondary hex theme color (`#rrggbb`), applied to `--info` CSS variable.
  - `tz`: Validated IANA default timezone.
  - `fmt`: Default clock format (`12` or `24`).
  - `sessions`: Filtered subset of displayed sessions (`sydney`, `tokyo`, `london`, `newyork`).
  - `labels`: Custom session labels (e.g., `london:London Killzone,newyork:NY Killzone`) with comma-safe encoding.
  - `embed`: Compact embed mode (`embed=1`) that hides the site header, hero text, tool cards, and footer for clean `<iframe>` embedding inside Notion, Discord, or LMS portals.
- **Interactive White-Label Studio (`/white-label`)**:
  - Includes 3 one-click fictional academy demo presets (`Apex Pip Academy (Demo)`, `Mumbai FX Academy (Demo)`, `Meridian Macro (Demo)`), 5 theme color palettes, live `<iframe>` preview, shareable client URL generator, responsive `<iframe>` snippet generator (HTML-escaped via `escapeHtml`), JSON configuration output, downloadable `branded-session-widget.html` wrapper, and $10 Basic / $25 Advanced service pricing cards.

## 4. Authentication, User Profile Dashboard & Academy Rental System

- **Supabase Authentication (`src/routes/login.tsx`, `src/routes/register.tsx`, `src/components/AuthProvider.tsx`)**:
  - Academy registration with Zod validation (`academyName`, `contactName`, `email`, optional `phone` and `country`, password confirmation), email confirmation redirect handling, login, logout, session persistence, and race-condition-safe state loading.
- **7-Section User Profile Dashboard (`src/components/UserProfileDashboard.tsx`, `/academy`, `/profile`)**:
  - **A. Overview**: Welcome banner, display name, organization, email, membership status badge, plan name, creation date, quick-jump section cards, and tool links.
  - **B. My Profile**: View/edit display name (`contact_name`), academy/organization name (`academy_name`), phone, and country in `public.academies` (enforced by RLS `auth.uid() = id`); separate secure email change flow via `supabase.auth.updateUser({ email })`.
  - **C. Membership**: Displays real database plan status, server-verified Academy Rental Access state (`is_active` from `public.get_my_academy_access()`), available features matrix, and the unlocked **Academy White-Label Branding Studio & Student Link Generator** for active rentals.
  - **D. Subscription Details**: Displays database `status`, `activated_at` start timestamp, `expires_at` expiry timestamp, and days remaining.
  - **E. Preferences**: Persistent timezone (`fsc_preferred_tz` / `ftt-zone`), 12H/24H clock format (`fsc_fmt`), pinned desk clocks (`fsc_pinned_zones`), and saved timezone profiles (`fsc_saved_profiles_v1`).
  - **F. Security**: Validated password update (`supabase.auth.updateUser({ password })`), password reset email trigger (`supabase.auth.resetPasswordForEmail`), session security metadata, and sign-out.
  - **G. Account Management**: Account summary record, status sync, sign-out, and administrator contact guidance.
- **Administrator Control Panel (`AdminAcademyConsole` in `src/components/UserProfileDashboard.tsx`)**:
  - Rendered only when server-side `supabase.rpc("is_admin")` returns `true`.
  - Lists all registered academies from `public.academies` with status filter tabs, search bar, and server-enforced **Activate (30d)**, **Renew (+30d)**, and **Deactivate** buttons calling `public.admin_set_academy_access`.
