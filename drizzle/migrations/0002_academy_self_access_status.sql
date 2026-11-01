/*
# Academy self-service access status function

1. New Functions
- `get_my_academy_access()`: returns the signed-in academy's own profile name, status, activation and expiry dates, plus `is_active`.
  - `is_active` is true only when the status is `active` and the expiry date is in the future, computed by the database clock.

2. Security
- Runs as the caller (SECURITY INVOKER), so the existing row-level security on `academies` still applies: the function can only see the caller's own row.
- Granted to signed-in users only; anonymous visitors cannot call it.
- No existing tables, policies, or grants are changed.

3. Important Notes
- Protected rental features should check the same `is_active` rule on the server before returning data.
*/

CREATE OR REPLACE FUNCTION public.get_my_academy_access()
RETURNS TABLE (
  academy_name text,
  status text,
  activated_at timestamptz,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    a.academy_name,
    a.status,
    a.activated_at,
    a.expires_at,
    (a.status = 'active' AND a.expires_at IS NOT NULL AND a.expires_at > now()) AS is_active
  FROM public.academies a
  WHERE a.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_academy_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_academy_access() TO authenticated;
