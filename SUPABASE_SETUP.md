# Supabase Database, Authentication & Administrator Setup Guide

This guide explains how **Forex Session Compass** integrates with Supabase for authentication, user profiles, academy rental access, and administrator management, and how a buyer can set up a brand-new Supabase project from scratch.

## 1. Required Environment Variables

The application reads two environment variables in `src/lib/supabase.ts`:

- `VITE_SUPABASE_URL`: Your Supabase project URL (`https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase `anon` public API key

Never put your `service_role` secret key into `.env` or frontend hosting variables. All privileged operations in this application are handled through PostgreSQL Row-Level Security (RLS) policies and `SECURITY DEFINER` / `SECURITY INVOKER` RPC functions.

## 2. Database Schema Overview

The database schema is defined across three chronological SQL migrations in `supabase/migrations/`:

### Migration 1: `supabase/migrations/20261031101444_academy_rental_foundation.sql`
1. **Table `public.academies`**:
   - `id` (`uuid`, Primary Key, references `auth.users(id) ON DELETE CASCADE`)
   - `email` (`text NOT NULL`)
   - `academy_name` (`text NOT NULL`, 2–120 chars)
   - `contact_name` (`text NOT NULL`, 2–120 chars)
   - `phone` (`text`, optional, ≤40 chars)
   - `country` (`text`, optional, ≤80 chars)
   - `status` (`text NOT NULL DEFAULT 'pending'`, constrained to `'pending'`, `'active'`, or `'suspended'`)
   - `activated_at` (`timestamptz`, nullable)
   - `expires_at` (`timestamptz`, nullable)
   - `created_at` (`timestamptz NOT NULL DEFAULT now()`)
   - `updated_at` (`timestamptz NOT NULL DEFAULT now()`)
2. **Table `public.admins`**:
   - `user_id` (`uuid`, Primary Key, references `auth.users(id) ON DELETE CASCADE`)
   - `created_at` (`timestamptz NOT NULL DEFAULT now()`)
   - All direct table privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) are revoked from `PUBLIC`, `anon`, and `authenticated`. Only `service_role` and `SECURITY DEFINER` functions can access `public.admins`.
3. **Row-Level & Column-Level Security**:
   - RLS is enabled on both `public.academies` and `public.admins`.
   - `authenticated` users are granted `SELECT` on `public.academies` and column-restricted `UPDATE (academy_name, contact_name, phone, country, updated_at) ON public.academies`. Users **cannot** update `status`, `activated_at`, or `expires_at` directly.
   - Policy `academies_select_own`: Users can `SELECT` their own row (`auth.uid() = id`).
   - Policy `academies_select_admin`: Administrators (`public.is_admin()`) can `SELECT` all rows in `public.academies`.
   - Policy `academies_update_own_profile`: Users can `UPDATE` their own row (`auth.uid() = id`).
4. **PostgreSQL Functions & Triggers**:
   - `public.is_admin()`: Returns `true` if `auth.uid()` exists in `public.admins`.
   - `public.handle_new_user()` + trigger `on_auth_user_created` on `auth.users`: Automatically inserts a `pending` row in `public.academies` whenever a new user registers via Supabase Auth, populating `academy_name`, `contact_name`, `phone`, and `country` from `raw_user_meta_data`.
   - `public.admin_set_academy_access(p_academy_id uuid, p_action text)`: Verifies `public.is_admin()` (raising SQLSTATE `42501` if unauthorized) and executes:
     - `'activate'`: Sets `status = 'active'`, `activated_at = now()`, `expires_at = now() + interval '30 days'`.
     - `'renew'`: Sets `status = 'active'` and extends `expires_at` by 30 days from `GREATEST(COALESCE(expires_at, now()), now())`.
     - `'deactivate'`: Sets `status = 'suspended'`.

### Migration 2: `supabase/migrations/20261031101511_academy_revoke_anon_read.sql`
- Executes `REVOKE ALL ON public.academies FROM anon;` so unauthenticated visitors have zero table privileges on `public.academies`.

### Migration 3: `supabase/migrations/20261031102101_academy_self_access_status.sql`
- Creates `public.get_my_academy_access()` (`SECURITY INVOKER`), returning `(academy_name, status, activated_at, expires_at, is_active)` for the currently signed-in user (`WHERE a.id = auth.uid()`), where `is_active` is evaluated by the database server clock:
  ```sql
  (a.status = 'active' AND a.expires_at IS NOT NULL AND a.expires_at > now()) AS is_active
  ```

## 3. Applying Migrations to a New Supabase Project

If you create a new Supabase project rather than taking transfer of the existing project:

### Method A: Via Supabase SQL Editor (No CLI Required)
1. Open your Supabase Dashboard → **SQL Editor → New query**.
2. Paste and run `supabase/migrations/20261031101444_academy_rental_foundation.sql`.
3. Paste and run `supabase/migrations/20261031101511_academy_revoke_anon_read.sql`.
4. Paste and run `supabase/migrations/20261031102101_academy_self_access_status.sql`.

### Method B: Via Supabase CLI
```sh
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## 4. Configuring Supabase Authentication Settings

In your Supabase Dashboard, navigate to **Authentication**:

1. **URL Configuration (`Authentication → URL Configuration`)**:
   - **Site URL**: Set to your live production domain (e.g., `https://forex-session-compass.lovable.app`).
   - **Redirect URLs**: Add the following paths for your production domain (and `http://localhost:5173` or `http://localhost:3000` for local development):
     - `https://<your-domain>/login`
     - `https://<your-domain>/login?confirmed=1`
     - `https://<your-domain>/academy`
     - `https://<your-domain>/profile`
2. **Email Provider (`Authentication → Providers → Email`)**:
   - Enable **Email** provider.
   - **Confirm email**: Can be toggled **Off** (for instant login after `/register`) or **On** (users receive a confirmation email redirecting to `/login?confirmed=1`; `src/routes/register.tsx` and `src/routes/login.tsx` support both modes).
   - **Secure email change**: Keep enabled so email updates requested from the User Profile Dashboard require inbox verification.

## 5. Bootstrapping Your Administrator Account

Normal registered users are **never** granted administrator rights automatically. To make your account an administrator:

1. Start the application and register your account via `/register`.
2. In your Supabase Dashboard, go to **Authentication → Users** and copy your user's **User UID** (UUID).
3. Open **SQL Editor** in Supabase and run:
   ```sql
   INSERT INTO public.admins (user_id)
   VALUES ('00000000-0000-0000-0000-000000000000') -- Replace with your actual User UID
   ON CONFLICT DO NOTHING;
   ```
4. Log in to `/academy` (or click **Sync Status**). The **Admin Console** section will now appear in your dashboard sidebar, allowing you to view all registered academies and click **Activate (30d)**, **Renew (+30d)**, or **Deactivate**.

## 6. Optional Database Hardening SQL

To ensure `updated_at` is always set by the PostgreSQL server clock on profile edits rather than accepting a client-supplied timestamp, you may optionally execute the following in the Supabase SQL Editor:

```sql
REVOKE UPDATE ON public.academies FROM authenticated;
GRANT UPDATE (academy_name, contact_name, phone, country) ON public.academies TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_academies_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_academies_updated_at ON public.academies;
CREATE TRIGGER on_academies_updated_at
  BEFORE UPDATE ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.touch_academies_updated_at();
```
