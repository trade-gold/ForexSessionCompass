DROP POLICY IF EXISTS settings_read ON public.app_settings;
CREATE POLICY settings_read_public_row ON public.app_settings
  FOR SELECT TO authenticated
  USING (id = 1);
REVOKE SELECT ON public.app_settings FROM authenticated, anon;
GRANT SELECT (payment_instructions) ON public.app_settings TO authenticated;