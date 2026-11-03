CREATE TABLE public.plans (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9_-]{2,30}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description text NOT NULL DEFAULT '',
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  period_days integer NOT NULL DEFAULT 30 CHECK (period_days BETWEEN 1 AND 3660),
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read ON public.plans FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.plans (id, name, description, price_cents, features, sort_order) VALUES
 ('free','Free','Session clocks, basic converter and session guides.',0,'{}',0),
 ('pro','Pro','Planning and risk tools for active traders.',NULL,'{overlap_advanced,workspace,risk_calculator,discipline,planner}',1),
 ('elite','Elite','Everything in Pro plus journal, analytics, event planner and reports.',NULL,'{overlap_advanced,workspace,risk_calculator,discipline,planner,journal,events,reports,alerts}',2);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_select ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id text NOT NULL REFERENCES public.plans(id),
  amount_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL CHECK (char_length(method) BETWEEN 2 AND 40),
  reference text NOT NULL CHECK (char_length(reference) BETWEEN 3 AND 120),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','verified','rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payment_instructions text NOT NULL DEFAULT 'Payment instructions have not been configured yet. Please contact the site owner.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Owner bootstrap: only a CONFIRMED auth account with a listed email becomes admin.
CREATE TABLE public.owner_emails (email text PRIMARY KEY);
REVOKE ALL ON public.owner_emails FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.owner_emails TO service_role;
ALTER TABLE public.owner_emails ENABLE ROW LEVEL SECURITY;
INSERT INTO public.owner_emails VALUES ('kondivarun2@gmail.com');

CREATE OR REPLACE FUNCTION public.grant_owner_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.owner_emails o WHERE o.email = lower(NEW.email)) THEN
    INSERT INTO public.admins (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.grant_owner_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_owner_check AFTER INSERT OR UPDATE OF email_confirmed_at, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin();
INSERT INTO public.admins (user_id)
  SELECT u.id FROM auth.users u JOIN public.owner_emails o ON o.email = lower(u.email)
  WHERE u.email_confirmed_at IS NOT NULL ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS TABLE(plan_id text, plan_name text, status text, expires_at timestamptz, is_admin boolean, features text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin boolean := public.is_admin();
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
    FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, 'Free'::text, 'active'::text, NULL::timestamptz, false, '{}'::text[];
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_feature(p_feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.get_my_entitlements() e WHERE p_feature = ANY(e.features))
$$;

CREATE OR REPLACE FUNCTION public.submit_payment(p_plan_id text, p_method text, p_reference text)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.plans; v_row public.payments;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND is_active AND id <> 'free';
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not available'; END IF;
  IF (SELECT count(*) FROM public.payments WHERE user_id = auth.uid() AND status = 'submitted') >= 3 THEN
    RAISE EXCEPTION 'You already have pending payments awaiting review';
  END IF;
  INSERT INTO public.payments (user_id, plan_id, amount_cents, currency, method, reference)
  VALUES (auth.uid(), v_plan.id, v_plan.price_cents, v_plan.currency, trim(p_method), trim(p_reference))
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription(p_user_id uuid, p_plan_id text, p_action text)
RETURNS public.subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan public.plans; v_row public.subscriptions;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  IF p_action = 'activate' THEN
    SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND id <> 'free';
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown paid plan'; END IF;
    INSERT INTO public.subscriptions (user_id, plan_id, status, starts_at, expires_at)
    VALUES (p_user_id, v_plan.id, 'active', now(), now() + make_interval(days => v_plan.period_days))
    ON CONFLICT (user_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, status = 'active',
      starts_at = CASE WHEN subscriptions.status = 'active' AND subscriptions.expires_at > now() AND subscriptions.plan_id = EXCLUDED.plan_id THEN subscriptions.starts_at ELSE now() END,
      expires_at = CASE WHEN subscriptions.status = 'active' AND subscriptions.plan_id = EXCLUDED.plan_id
        THEN greatest(subscriptions.expires_at, now()) + make_interval(days => v_plan.period_days)
        ELSE now() + make_interval(days => v_plan.period_days) END,
      updated_at = now()
    RETURNING * INTO v_row;
  ELSIF p_action IN ('suspend','cancel') THEN
    UPDATE public.subscriptions SET status = CASE p_action WHEN 'suspend' THEN 'suspended' ELSE 'cancelled' END, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'No subscription for this user'; END IF;
  ELSE RAISE EXCEPTION 'Unknown action';
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_payment(p_payment_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.payments;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  UPDATE public.payments SET status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
    admin_note = nullif(trim(coalesce(p_note,'')), ''), reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = p_payment_id AND status = 'submitted' RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found or already reviewed'; END IF;
  IF p_approve THEN PERFORM public.admin_set_subscription(v_row.user_id, v_row.plan_id, 'activate'); END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_plan(p_id text, p_name text, p_description text, p_price_cents integer, p_currency text, p_period_days integer, p_features text[], p_is_active boolean)
RETURNS public.plans LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.plans;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  UPDATE public.plans SET name = p_name, description = coalesce(p_description,''), price_cents = p_price_cents,
    currency = upper(p_currency), period_days = p_period_days,
    features = CASE WHEN id = 'free' THEN '{}' ELSE coalesce(p_features,'{}') END,
    is_active = CASE WHEN id = 'free' THEN true ELSE p_is_active END, updated_at = now()
  WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown plan'; END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_payment_instructions(p_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  IF char_length(trim(p_text)) NOT BETWEEN 5 AND 4000 THEN RAISE EXCEPTION 'Instructions must be 5-4000 characters'; END IF;
  UPDATE public.app_settings SET payment_instructions = trim(p_text), updated_at = now() WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS TABLE(total_users bigint, active_subscriptions bigint, pending_payments bigint, verified_payments bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT (SELECT count(*) FROM public.academies),
    (SELECT count(*) FROM public.subscriptions WHERE status='active' AND expires_at > now()),
    (SELECT count(*) FROM public.payments WHERE status='submitted'),
    (SELECT count(*) FROM public.payments WHERE status='verified');
END $$;

REVOKE EXECUTE ON FUNCTION public.get_my_entitlements(), public.has_feature(text), public.submit_payment(text,text,text),
  public.admin_set_subscription(uuid,text,text), public.admin_review_payment(uuid,boolean,text),
  public.admin_update_plan(text,text,text,integer,text,integer,text[],boolean), public.admin_set_payment_instructions(text),
  public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements(), public.has_feature(text), public.submit_payment(text,text,text),
  public.admin_set_subscription(uuid,text,text), public.admin_review_payment(uuid,boolean,text),
  public.admin_update_plan(text,text,text,integer,text,integer,text[],boolean), public.admin_set_payment_instructions(text),
  public.admin_stats() TO authenticated;