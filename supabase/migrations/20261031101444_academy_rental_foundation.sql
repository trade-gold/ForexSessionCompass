/*
# Academy rental access foundation

1. New Tables
- `academies`: one row per registered academy account, keyed to its sign-in user.
  - `id` (uuid, primary key, references auth.users)
  - `email` (text)
  - `academy_name`, `contact_name` (text, required), `phone`, `country` (text, optional)
  - `status` (text): `pending` (registered, not yet paid/activated), `active`, or `suspended`
  - `activated_at`, `expires_at` (timestamptz): access window, 30 days per activation or renewal
  - `created_at`, `updated_at`
- `admins`: user ids allowed to use administrator operations. Not readable or writable by app users.

2. Functions
- `is_admin()`: returns true when the signed-in user is listed in `admins`.
- `handle_new_user()`: trigger that creates the academy row when a sign-up completes.
- `admin_set_academy_access(academy_id, action)`: the only path that changes status or dates. Actions:
  - `activate`: sets status to active, starts a new 30-day window from now.
  - `renew`: extends the window by 30 days from the current expiry (or from now if already expired).
  - `deactivate`: sets status to suspended.

3. Security
- RLS enabled on `academies` and `admins`.
- Academy users can read only their own row and update only their profile fields (name, contact, phone, country).
- Academy users cannot change status or dates: column privileges block it, and the admin function is the only way.
- Administrators can read all academy rows through `is_admin()`.
- `admins` has no grants for app roles; only security-definer functions read it.
- The admin function checks `is_admin()` itself and raises an error for anyone else.

4. Important Notes
- Administrators are added by inserting their user id into `admins` (done manually by the owner).
- Sign-up creates the academy row with status `pending`, so new accounts have no access until an administrator activates them.
- Dates are computed on the server only; the browser never supplies an expiry.
*/

CREATE TABLE IF NOT EXISTS public.academies (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  academy_name text NOT NULL CHECK (char_length(academy_name) BETWEEN 2 AND 120),
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 2 AND 120),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  country text CHECK (country IS NULL OR char_length(country) <= 80),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academies_status_expires_idx ON public.academies (status, expires_at);

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admins FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.academies TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.academies FROM anon, authenticated;
GRANT UPDATE (academy_name, contact_name, phone, country, updated_at) ON public.academies TO authenticated;
GRANT ALL ON public.academies TO service_role;
GRANT ALL ON public.admins TO service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.academies (id, email, academy_name, contact_name, phone, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'academy_name'), ''), 'New academy'), 120),
    left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'contact_name'), ''), 'Contact'), 120),
    left(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), 40),
    left(NULLIF(trim(NEW.raw_user_meta_data->>'country'), ''), 80)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_set_academy_access(p_academy_id uuid, p_action text)
RETURNS public.academies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.academies;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'activate' THEN
    UPDATE public.academies
       SET status = 'active', activated_at = v_now, expires_at = v_now + interval '30 days', updated_at = v_now
     WHERE id = p_academy_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'renew' THEN
    UPDATE public.academies
       SET status = 'active',
           activated_at = COALESCE(activated_at, v_now),
           expires_at = GREATEST(COALESCE(expires_at, v_now), v_now) + interval '30 days',
           updated_at = v_now
     WHERE id = p_academy_id
     RETURNING * INTO v_row;
  ELSIF p_action = 'deactivate' THEN
    UPDATE public.academies
       SET status = 'suspended', updated_at = v_now
     WHERE id = p_academy_id
     RETURNING * INTO v_row;
  ELSE
    RAISE EXCEPTION 'Unknown action' USING ERRCODE = '22023';
  END IF;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Academy not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_academy_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_academy_access(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "academies_select_own" ON public.academies;
CREATE POLICY "academies_select_own" ON public.academies FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "academies_select_admin" ON public.academies;
CREATE POLICY "academies_select_admin" ON public.academies FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "academies_update_own_profile" ON public.academies;
CREATE POLICY "academies_update_own_profile" ON public.academies FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
