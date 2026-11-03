/*
# Stage 2–4: Trader Productivity Suite (Pro & Elite)
Adds user-isolated tables for:
1. `public.trader_discipline_rules` (PRO / ELITE — `discipline`)
2. `public.trade_journal_entries` (ELITE — `journal` & `reports`)
3. `public.session_planner_configs` (PRO / ELITE — `planner`, `alerts`, `overlap_advanced`, `workspace`)
4. `public.economic_risk_events` (ELITE — `events`)

Security & Access Control:
- Every table enforces PostgreSQL Row-Level Security (`auth.uid() = user_id`).
- Both SELECT and write (INSERT/UPDATE/DELETE) policies verify active feature entitlements on the backend via `public.has_feature(...) OR public.is_admin()`, preventing direct database queries from bypassing expired, cancelled, or unsubscribed states.
- Preserves all existing tables, columns, triggers, and policies without modification.
*/

-- 1. Trader Discipline Guardian Rules & Daily Log (PRO / ELITE)
CREATE TABLE IF NOT EXISTS public.trader_discipline_rules (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  max_daily_trades integer NOT NULL DEFAULT 3 CHECK (max_daily_trades BETWEEN 1 AND 50),
  max_daily_loss_amount numeric(12,2) NOT NULL DEFAULT 200.00 CHECK (max_daily_loss_amount >= 0),
  max_risk_percent numeric(5,2) NOT NULL DEFAULT 1.00 CHECK (max_risk_percent > 0 AND max_risk_percent <= 20),
  cooldown_minutes integer NOT NULL DEFAULT 30 CHECK (cooldown_minutes BETWEEN 0 AND 1440),
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_log jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trader_discipline_rules TO authenticated;
GRANT ALL ON public.trader_discipline_rules TO service_role;
ALTER TABLE public.trader_discipline_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discipline_select_own ON public.trader_discipline_rules;
CREATE POLICY discipline_select_own ON public.trader_discipline_rules
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_id AND public.has_feature('discipline'))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS discipline_write_own ON public.trader_discipline_rules;
CREATE POLICY discipline_write_own ON public.trader_discipline_rules
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_feature('discipline') OR public.is_admin()))
  WITH CHECK (auth.uid() = user_id AND (public.has_feature('discipline') OR public.is_admin()));

-- 2. Trade Performance Intelligence & Journal Entries (ELITE)
CREATE TABLE IF NOT EXISTS public.trade_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair text NOT NULL CHECK (char_length(pair) BETWEEN 3 AND 20),
  direction text NOT NULL CHECK (direction IN ('long', 'short')),
  session_id text NOT NULL CHECK (session_id IN ('sydney', 'tokyo', 'london', 'newyork', 'overlap')),
  entry_price numeric(16,6) NOT NULL,
  exit_price numeric(16,6) NOT NULL,
  stop_loss numeric(16,6),
  take_profit numeric(16,6),
  lot_size numeric(10,2) NOT NULL DEFAULT 0.10 CHECK (lot_size > 0),
  pnl_amount numeric(12,2) NOT NULL,
  r_multiple numeric(8,2) NOT NULL DEFAULT 0,
  outcome text NOT NULL CHECK (outcome IN ('win', 'loss', 'breakeven')),
  strategy_tag text NOT NULL DEFAULT 'General' CHECK (char_length(strategy_tag) BETWEEN 1 AND 60),
  mistake_tag text NOT NULL DEFAULT 'None' CHECK (char_length(mistake_tag) BETWEEN 1 AND 60),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  traded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_journal_entries
  ADD COLUMN IF NOT EXISTS take_profit numeric(16,6),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS trade_journal_user_traded_idx ON public.trade_journal_entries (user_id, traded_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_journal_entries TO authenticated;
GRANT ALL ON public.trade_journal_entries TO service_role;
ALTER TABLE public.trade_journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_select_own ON public.trade_journal_entries;
CREATE POLICY journal_select_own ON public.trade_journal_entries
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_id AND (public.has_feature('journal') OR public.has_feature('reports')))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS journal_write_own ON public.trade_journal_entries;
CREATE POLICY journal_write_own ON public.trade_journal_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_feature('journal') OR public.is_admin()))
  WITH CHECK (auth.uid() = user_id AND (public.has_feature('journal') OR public.is_admin()));

-- 3. Session Opportunity Planner & Multi-Timezone Workspace Configurations (PRO / ELITE)
CREATE TABLE IF NOT EXISTS public.session_planner_configs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_sessions text[] NOT NULL DEFAULT '{london,newyork}',
  preferred_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  overlap_alerts boolean NOT NULL DEFAULT true,
  notifications_enabled boolean NOT NULL DEFAULT false,
  prep_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  workspace_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  alert_lead_minutes integer NOT NULL DEFAULT 15 CHECK (alert_lead_minutes BETWEEN 1 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_planner_configs
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workspace_config jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_planner_configs TO authenticated;
GRANT ALL ON public.session_planner_configs TO service_role;
ALTER TABLE public.session_planner_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planner_select_own ON public.session_planner_configs;
CREATE POLICY planner_select_own ON public.session_planner_configs
  FOR SELECT TO authenticated
  USING (
    (
      auth.uid() = user_id
      AND (
        public.has_feature('planner')
        OR public.has_feature('workspace')
        OR public.has_feature('overlap_advanced')
      )
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS planner_write_own ON public.session_planner_configs;
CREATE POLICY planner_write_own ON public.session_planner_configs
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND (
      public.has_feature('planner')
      OR public.has_feature('workspace')
      OR public.has_feature('overlap_advanced')
      OR public.is_admin()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_feature('planner')
      OR public.has_feature('workspace')
      OR public.has_feature('overlap_advanced')
      OR public.is_admin()
    )
  );

-- 4. Economic Event Risk Planner Entries (ELITE)
CREATE TABLE IF NOT EXISTS public.economic_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  currency text NOT NULL CHECK (char_length(currency) BETWEEN 2 AND 10),
  impact text NOT NULL CHECK (impact IN ('high', 'medium', 'low')),
  event_time timestamptz NOT NULL,
  pre_window_minutes integer NOT NULL DEFAULT 15 CHECK (pre_window_minutes BETWEEN 0 AND 240),
  post_window_minutes integer NOT NULL DEFAULT 15 CHECK (post_window_minutes BETWEEN 0 AND 240),
  source_label text NOT NULL DEFAULT 'Manual User Entry' CHECK (char_length(source_label) BETWEEN 2 AND 120),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS economic_events_user_time_idx ON public.economic_risk_events (user_id, event_time ASC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economic_risk_events TO authenticated;
GRANT ALL ON public.economic_risk_events TO service_role;
ALTER TABLE public.economic_risk_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select_own ON public.economic_risk_events;
CREATE POLICY events_select_own ON public.economic_risk_events
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_id AND public.has_feature('events'))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS events_write_own ON public.economic_risk_events;
CREATE POLICY events_write_own ON public.economic_risk_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_feature('events') OR public.is_admin()))
  WITH CHECK (auth.uid() = user_id AND (public.has_feature('events') OR public.is_admin()));