# Supabase Database, Authentication & Administrator Setup Guide

This guide explains how **Forex Session Compass** integrates with Supabase for authentication, user profiles, unified subscriptions (Free, Pro, Elite, and Academy White-Label), trader productivity tools, and administrator management, and how a buyer can set up a brand-new Supabase project from scratch in under 5 minutes.

## 1. Required Environment Variables

The application reads two public environment variables in `.env`:

- `VITE_SUPABASE_URL`: Your Supabase project URL (`https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase `anon` / publishable public API key

Never put your `service_role` secret key into `.env` or frontend hosting variables. All privileged operations in this application are enforced on the PostgreSQL backend through Row-Level Security (RLS) policies, column-level GRANTs, and `SECURITY DEFINER` / `SECURITY INVOKER` RPC functions with pinned `search_path = ''`.

## 2. Database Schema & Chronological Migrations (`supabase/migrations/`)

All 6 SQL migrations in `supabase/migrations/` use strict chronological `YYYYMMDDHHMMSS_` prefixes so `npx supabase db push` or manual execution runs cleanly on a brand-new database without dependency ordering errors:

1. **`20261031101444_academy_rental_foundation.sql`**:
   - Creates `public.academies` (user/academy profile & rental state) and `public.admins` (restricted administrator table).
   - Enables RLS, sets column-restricted `UPDATE` grants on `public.academies`, and creates `public.is_admin()`, `public.handle_new_user()`, and `public.admin_set_academy_access()`.
2. **`20261031101511_academy_revoke_anon_read.sql`**:
   - Revokes all privileges on `public.academies` from `anon`.
3. **`20261031102101_academy_self_access_status.sql`**:
   - Creates `public.get_my_academy_access()` evaluating active rental windows using the PostgreSQL server clock (`now()`).
4. **`20261031103000_subscription_plans_payments.sql`**:
   - Creates `public.plans`, `public.subscriptions`, `public.payments`, `public.app_settings`, and `public.owner_emails` with RLS enabled on all tables.
   - Creates `public.get_my_entitlements()`, `public.has_feature()`, `public.submit_payment()`, `public.admin_set_subscription()`, `public.admin_review_payment()`, `public.admin_update_plan()`, `public.admin_set_payment_instructions()`, and `public.admin_stats()`.
5. **`20261031104000_trader_productivity_suite.sql`**:
   - Creates the 4 user-isolated Pro/Elite trader tables (`public.trader_discipline_rules`, `public.trade_journal_entries`, `public.session_planner_configs`, and `public.economic_risk_events`) gated by both `auth.uid() = user_id` and `public.has_feature(...)`.
6. **`20261102120000_security_and_commercial_unification.sql`**:
   - **Defense-in-Depth Hardening**: Explicit table-level `REVOKE` of write/truncate privileges from `anon` and `authenticated` on `plans`, `subscriptions`, `payments`, and `app_settings`; server-enforced `touch_academies_updated_at()` trigger; JSONB payload size constraints (`64 KB` / `256 KB`); per-user row cap triggers (`50,000` journal entries / `5,000` economic events); and unique payment reference index (`payments_unique_reference_idx`) preventing UTR replay fraud.
   - **Zero-Knowledge Trader Privacy**: Enforces strict owner-only `SELECT` (`auth.uid() = user_id`) on all 4 private trader tables so even if an admin session were compromised, other users' trade journals and PnL notes cannot be read.
   - **First-Boot Admin Lock & Audit Trail**: Locks `grant_owner_admin()` with `NOT EXISTS (SELECT 1 FROM public.admins)` so auto-promotion can only occur once on an empty admin table, and creates `public.admin_audit_logs` to record every admin action.
   - **Commercial Unification & Verified Academy Slugs**: Configures turnkey default pricing (`Pro $19/30d`, `Elite $49/30d`, `Academy & Tutor White-Label $99/30d`), synchronizes `public.subscriptions` and `public.academies` bidirectionally across both admin consoles, and adds `academy_slug` + `public.get_verified_academy_brand(p_slug)`.

## 3. Applying Migrations to a New Supabase Project

### Method A: Via Supabase CLI (Recommended)
```sh
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Method B: Via Supabase SQL Editor (No CLI Required)
Open your Supabase Dashboard → **SQL Editor → New query**, and execute the 6 files in `supabase/migrations/` in exact chronological order from `20261031101444_...` through `20261102120000_...`.

## 4. Bootstrapping Your Administrator Account

1. Register your owner account via `/register`.
2. In your Supabase Dashboard, go to **Authentication → Users** and copy your **User UID** (UUID).
3. Open **SQL Editor** in Supabase and run:
   ```sql
   DELETE FROM public.owner_emails;
   INSERT INTO public.admins (user_id)
   VALUES ('00000000-0000-0000-0000-000000000000') -- Replace with your actual User UID
   ON CONFLICT DO NOTHING;
   ```
4. Log in and visit `/admin` (Owner Console for plans, pricing, payments & subscriptions) or `/academy` (User & Academy Profile Dashboard).
