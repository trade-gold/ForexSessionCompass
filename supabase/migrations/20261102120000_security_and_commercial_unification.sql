/*
  =========================================================================================
  MIGRATION 6: SECURITY HARDENING & COMMERCIAL SUBSCRIPTION / ACADEMY UNIFICATION
  =========================================================================================
  1. Defense-in-depth privilege cleanup (explicit REVOKE on plans, subscriptions, payments,
     app_settings, and trader tables; server-enforced updated_at trigger on academies).
  2. Zero-knowledge owner-only privacy on trader tables (removes cross-user admin SELECT on
     private trade journals, discipline logs, planner configs, and economic events).
  3. JSONB size caps, per-user row caps (50k journal / 5k events), and duplicate payment
     reference (UTR) fraud guard.
  4. Hardened first-boot admin lock on grant_owner_admin() + immutable public.admin_audit_logs.
  5. Commercial Unification:
     - Sets ready-to-sell default prices on Pro ($19/30d), Elite ($49/30d), and Academy
       White-Label ($99/30d) plans while keeping prices 100% editable in /admin.
     - Synchronizes public.subscriptions and public.academies bidirectionally in
       admin_set_subscription(), admin_set_academy_access(), get_my_entitlements(), and
       get_my_academy_access() so users never see mismatched status between /profile & /tools.
     - Adds verified academy white-label registry columns (academy_slug, brand_config) and
       public.get_verified_academy_brand(p_slug) to verify active academy rentals.
*/

-- ---------------------------------------------------------------------------------------
-- 1. Defense-in-depth privilege cleanup & server-enforced updated_at
-- ---------------------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.plans FROM anon, authenticated;

REVOKE ALL ON public.subscriptions, public.payments, public.app_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.subscriptions, public.payments, public.app_settings FROM authenticated;

REVOKE ALL ON public.trader_discipline_rules, public.trade_journal_entries,
               public.session_planner_configs, public.economic_risk_events FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.trader_discipline_rules, public.trade_journal_entries,
               public.session_planner_configs, public.economic_risk_events FROM authenticated;

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

-- ---------------------------------------------------------------------------------------
-- 2. Zero-knowledge owner-only SELECT on private trader tables
--    (Admins retain access to their own rows via auth.uid() = user_id, but cannot read
--     other users' private trading journals or PnL records.)
-- ---------------------------------------------------------------------------------------
DROP POLICY IF EXISTS discipline_select_own ON public.trader_discipline_rules;
CREATE POLICY discipline_select_own ON public.trader_discipline_rules
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id AND (public.has_feature('discipline') OR public.is_admin())
  );

DROP POLICY IF EXISTS journal_select_own ON public.trade_journal_entries;
CREATE POLICY journal_select_own ON public.trade_journal_entries
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id AND (public.has_feature('journal') OR public.has_feature('reports') OR public.is_admin())
  );

DROP POLICY IF EXISTS planner_select_own ON public.session_planner_configs;
CREATE POLICY planner_select_own ON public.session_planner_configs
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      public.has_feature('planner')
      OR public.has_feature('workspace')
      OR public.has_feature('overlap_advanced')
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS events_select_own ON public.economic_risk_events;
CREATE POLICY events_select_own ON public.economic_risk_events
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id AND (public.has_feature('events') OR public.is_admin())
  );

-- ---------------------------------------------------------------------------------------
-- 3. JSONB size caps, per-user row caps, and duplicate payment-reference guard
-- ---------------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discipline_json_size_chk') THEN
    ALTER TABLE public.trader_discipline_rules
      ADD CONSTRAINT discipline_json_size_chk CHECK (
        octet_length(checklist_items::text) <= 65536 AND octet_length(daily_log::text) <= 262144
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planner_json_size_chk') THEN
    ALTER TABLE public.session_planner_configs
      ADD CONSTRAINT planner_json_size_chk CHECK (
        octet_length(preferred_windows::text) <= 65536
        AND octet_length(prep_checklist::text) <= 65536
        AND octet_length(workspace_config::text) <= 65536
        AND cardinality(preferred_sessions) <= 10
      ) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_user_row_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cap integer := TG_ARGV[0]::integer;
  v_count integer;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE user_id = $1', TG_TABLE_SCHEMA, TG_TABLE_NAME)
    INTO v_count USING NEW.user_id;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'Limit of % rows reached for this feature', v_cap USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_user_row_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS journal_row_cap ON public.trade_journal_entries;
CREATE TRIGGER journal_row_cap BEFORE INSERT ON public.trade_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_row_cap(50000);

DROP TRIGGER IF EXISTS events_row_cap ON public.economic_risk_events;
CREATE TRIGGER events_row_cap BEFORE INSERT ON public.economic_risk_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_row_cap(5000);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payments WHERE status IN ('submitted', 'verified')
    GROUP BY lower(method), lower(reference) HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'payments_unique_reference_idx NOT created: duplicate (method, reference) rows already exist.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS payments_unique_reference_idx
      ON public.payments (lower(method), lower(reference))
      WHERE status IN ('submitted', 'verified');
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------
-- 4. Hardened first-boot admin bootstrap & immutable public.admin_audit_logs
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 80),
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

DROP POLICY IF EXISTS admin_audit_logs_select ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_select ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- First-boot lock: only promotes an owner_emails account if email is confirmed AND
-- no admin exists yet in public.admins, preventing post-handover account takeover.
CREATE OR REPLACE FUNCTION public.grant_owner_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.admins)
     AND EXISTS (SELECT 1 FROM public.owner_emails o WHERE o.email = lower(NEW.email)) THEN
    INSERT INTO public.admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.grant_owner_admin() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- 5. Commercial Unification: Turnkey Plan Pricing, Bidirectional Sync & Verified Slugs
-- ---------------------------------------------------------------------------------------
UPDATE public.plans
   SET price_cents = 1900,
       description = 'Position risk calculator, discipline guardian, session planner & multi-timezone workspace for active traders.'
 WHERE id = 'pro' AND price_cents IS NULL;

UPDATE public.plans
   SET price_cents = 4900,
       features = '{overlap_advanced,workspace,risk_calculator,discipline,planner,journal,events,reports,alerts}',
       description = 'Full Pro suite plus trade journal, performance analytics, macro blackout planner & white-label customization.'
 WHERE id = 'elite' AND price_cents IS NULL;

INSERT INTO public.plans (id, name, description, price_cents, currency, period_days, features, is_active, sort_order)
VALUES (
  'academy',
  'Academy & Tutor White-Label',
  'Turnkey B2B plan for trading academies, mentors & Discord/Whop communities: verified white-label student clock, LMS embeds & full Elite trader suite.',
  9900,
  'USD',
  30,
  '{overlap_advanced,workspace,risk_calculator,discipline,planner,journal,events,reports,alerts}',
  true,
  3
)
ON CONFLICT (id) DO UPDATE
  SET features = EXCLUDED.features,
      price_cents = COALESCE(public.plans.price_cents, EXCLUDED.price_cents);

ALTER TABLE public.academies
  ADD COLUMN IF NOT EXISTS academy_slug text UNIQUE CHECK (academy_slug IS NULL OR academy_slug ~ '^[a-z0-9-]{3,60}$'),
  ADD COLUMN IF NOT EXISTS brand_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(brand_config::text) <= 16384);

REVOKE UPDATE ON public.academies FROM authenticated;
GRANT UPDATE (academy_name, contact_name, phone, country, academy_slug, brand_config) ON public.academies TO authenticated;

CREATE OR REPLACE FUNCTION public.get_verified_academy_brand(p_slug text)
RETURNS TABLE (
  academy_slug text,
  academy_name text,
  brand_config jsonb,
  is_verified boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.academy_slug,
    a.academy_name,
    a.brand_config,
    true AS is_verified
  FROM public.academies a
  WHERE a.academy_slug = lower(trim(p_slug))
    AND a.status = 'active'
    AND a.expires_at IS NOT NULL
    AND a.expires_at > now()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_verified_academy_brand(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_verified_academy_brand(text) TO anon, authenticated;

-- Unified get_my_academy_access(): reflects active status from EITHER public.academies OR public.subscriptions
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
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    a.academy_name,
    CASE
      WHEN public.is_admin() THEN 'active'
      WHEN s.status = 'active' AND s.expires_at > now() THEN 'active'
      ELSE a.status
    END AS status,
    COALESCE(s.starts_at, a.activated_at) AS activated_at,
    GREATEST(COALESCE(s.expires_at, a.expires_at), COALESCE(a.expires_at, s.expires_at)) AS expires_at,
    (
      public.is_admin()
      OR (a.status = 'active' AND a.expires_at IS NOT NULL AND a.expires_at > now())
      OR (s.status = 'active' AND s.expires_at > now())
    ) AS is_active
  FROM public.academies a
  LEFT JOIN public.subscriptions s ON s.user_id = a.id
  WHERE a.id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_academy_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_academy_access() TO authenticated;

-- Unified get_my_entitlements(): grants Elite + White-Label features if academy rental is active
CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS TABLE(plan_id text, plan_name text, status text, expires_at timestamptz, is_admin boolean, features text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin boolean := public.is_admin();
  v_acad public.academies;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF v_admin THEN
    RETURN QUERY SELECT 'owner'::text, 'Owner (all features)'::text, 'active'::text, NULL::timestamptz, true,
      (SELECT coalesce(array_agg(DISTINCT f), '{}') FROM public.plans p, unnest(p.features) f);
    RETURN;
  END IF;

  RETURN QUERY
    SELECT s.plan_id, p.name,
      CASE WHEN s.status = 'active' AND s.expires_at <= now() THEN 'expired' ELSE s.status END,
      s.expires_at, false,
      CASE WHEN s.status = 'active' AND s.expires_at > now() AND p.is_active THEN p.features ELSE '{}'::text[] END
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = auth.uid();
  IF FOUND THEN RETURN; END IF;

  -- Fallback: if activated via Academy Rental Console without a row in subscriptions yet
  SELECT * INTO v_acad FROM public.academies WHERE id = auth.uid();
  IF FOUND AND v_acad.status = 'active' AND v_acad.expires_at IS NOT NULL THEN
    IF v_acad.expires_at > now() THEN
      RETURN QUERY
        SELECT 'academy'::text, '30-Day Academy Rental Plan'::text, 'active'::text, v_acad.expires_at, false,
          coalesce((SELECT p.features FROM public.plans p WHERE p.id = 'academy'), '{overlap_advanced,workspace,risk_calculator,discipline,planner,journal,events,reports,alerts}'::text[]);
      RETURN;
    ELSE
      RETURN QUERY SELECT 'academy'::text, '30-Day Academy Rental Plan'::text, 'expired'::text, v_acad.expires_at, false, '{}'::text[];
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT 'free'::text, 'Free'::text, 'active'::text, NULL::timestamptz, false, '{}'::text[];
END;
$$;

-- Bidirectional sync in admin_set_subscription() + audit log
CREATE OR REPLACE FUNCTION public.admin_set_subscription(p_user_id uuid, p_plan_id text, p_action text)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans;
  v_row public.subscriptions;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  IF p_action = 'activate' THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND id <> 'free';
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown paid plan'; END IF;
    INSERT INTO public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
    VALUES (p_user_id, v_plan.id, 'active', now(), now() + make_interval(days => v_plan.period_days))
    ON CONFLICT (user_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, status = 'active',
      starts_at = CASE WHEN public.subscriptions.status = 'active' AND public.subscriptions.expires_at > now() AND public.subscriptions.plan_id = EXCLUDED.plan_id THEN public.subscriptions.starts_at ELSE now() END,
      expires_at = CASE WHEN public.subscriptions.status = 'active' AND public.subscriptions.plan_id = EXCLUDED.plan_id
        THEN greatest(public.subscriptions.expires_at, now()) + make_interval(days => v_plan.period_days)
        ELSE now() + make_interval(days => v_plan.period_days) END,
      updated_at = now()
    RETURNING * INTO v_row;

    UPDATE public.academies
       SET status = 'active',
           activated_at = v_row.starts_at,
           expires_at = v_row.expires_at,
           updated_at = now()
     WHERE id = p_user_id;
  ELSIF p_action IN ('suspend', 'cancel') THEN
    UPDATE public.subscriptions
       SET status = CASE p_action WHEN 'suspend' THEN 'suspended' ELSE 'cancelled' END,
           updated_at = now()
     WHERE user_id = p_user_id
     RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'No subscription for this user'; END IF;

    UPDATE public.academies
       SET status = 'suspended',
           updated_at = now()
     WHERE id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, details)
  VALUES (auth.uid(), 'admin_set_subscription:' || p_action, p_user_id, jsonb_build_object('plan_id', p_plan_id, 'expires_at', v_row.expires_at));

  RETURN v_row;
END;
$$;

-- Bidirectional sync in admin_set_academy_access() + audit log
CREATE OR REPLACE FUNCTION public.admin_set_academy_access(p_academy_id uuid, p_action text)
RETURNS public.academies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.academies;
  v_now timestamptz := now();
  v_target_plan text := CASE WHEN EXISTS (SELECT 1 FROM public.plans WHERE id = 'academy') THEN 'academy' ELSE 'elite' END;
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

  -- Synchronize public.subscriptions so /tools and /pricing reflect the academy status
  IF p_action IN ('activate', 'renew') THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, starts_at, expires_at, updated_at)
    VALUES (p_academy_id, v_target_plan, 'active', COALESCE(v_row.activated_at, v_now), v_row.expires_at, v_now)
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'active',
          starts_at = COALESCE(EXCLUDED.starts_at, public.subscriptions.starts_at),
          expires_at = GREATEST(public.subscriptions.expires_at, EXCLUDED.expires_at),
          updated_at = v_now;
  ELSIF p_action = 'deactivate' THEN
    UPDATE public.subscriptions
       SET status = 'suspended', updated_at = v_now
     WHERE user_id = p_academy_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, details)
  VALUES (auth.uid(), 'admin_set_academy_access:' || p_action, p_academy_id, jsonb_build_object('status', v_row.status, 'expires_at', v_row.expires_at));

  RETURN v_row;
END;
$$;
