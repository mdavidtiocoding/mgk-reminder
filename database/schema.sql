-- MGK Flow Reminder — Database Schema (Flow v2 — MOM-based, 32 coded steps, DAG/parallel)
-- Run in Supabase Dashboard → SQL Editor
--
-- NOTE: if you already have a v1 (22-step, sequential) database deployed,
-- do NOT run this file — run database/add-flow-v2.sql instead, which migrates
-- an existing install in place.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  division TEXT CHECK (
    division IS NULL OR division IN (
      'marketing', 'ar', 'logistik', 'finance', 'shipping', 'project', 'admin'
    )
  ),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'suspended')
  ),
  notif_email BOOLEAN DEFAULT true,
  notif_push BOOLEAN DEFAULT true,
  notif_google_calendar BOOLEAN DEFAULT false,
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_calendar_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step definitions — mirrors lib/steps.ts. Drives RLS + active-step (DAG) logic.
CREATE TABLE public.step_definitions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  stage INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  prerequisites TEXT[] NOT NULL DEFAULT '{}',
  checklist_items TEXT[]
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  ex_work_date DATE,
  etd_date DATE,
  eta_date DATE,
  mos_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  completed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  completed_at TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  outcome TEXT,
  UNIQUE (project_id, step_code)
);

-- Repeat cadence / channel per step. The "when does the first reminder fire"
-- logic (immediate / after_step / before_date / after_date) lives in code
-- (lib/steps.ts) — this table only holds admin-tunable overrides.
CREATE TABLE public.reminder_config (
  step_code TEXT PRIMARY KEY REFERENCES public.step_definitions(code),
  enabled BOOLEAN NOT NULL DEFAULT true,
  repeat_days INTEGER,
  max_repeats INTEGER,
  notify_channel TEXT NOT NULL DEFAULT 'all' CHECK (
    notify_channel IN ('all', 'email', 'push', 'calendar')
  )
);

CREATE TABLE public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  sent_at TIMESTAMPTZ DEFAULT now(),
  channel TEXT NOT NULL
);

CREATE TABLE public.adhoc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  note TEXT
);

CREATE TABLE public.followup_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL DEFAULT '09:00:00',
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  UNIQUE (project_id, step_code)
);

-- Google Calendar event IDs (so we can clear reminders when a step is done)
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('step_unlock', 'followup')),
  reminders_cleared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- App-wide tunable settings (hogger / warning thresholds)
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_customer_id ON public.projects(customer_id);
CREATE INDEX idx_step_completions_project_id ON public.step_completions(project_id);
CREATE INDEX idx_step_completions_project_step ON public.step_completions(project_id, step_code);
CREATE INDEX idx_reminder_log_project_id ON public.reminder_log(project_id);
CREATE INDEX idx_adhoc_cases_project_id ON public.adhoc_cases(project_id);
CREATE INDEX idx_followup_schedule_project_id ON public.followup_schedule(project_id);
CREATE INDEX idx_followup_schedule_due ON public.followup_schedule(scheduled_date)
  WHERE notified_at IS NULL;
CREATE INDEX idx_calendar_events_project_step ON public.calendar_events(project_id, step_code);
CREATE INDEX idx_calendar_events_user ON public.calendar_events(user_id);

-- ---------------------------------------------------------------------------
-- Helper functions (must run AFTER tables exist)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_division()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT division FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND division = 'admin' AND status = 'active'
  );
$$;

-- Step codes currently "active" (unlocked) for a project: all prerequisites
-- done AND not itself done yet. Supports the parallel/DAG flow.
CREATE OR REPLACE FUNCTION public.project_active_step_codes(p_project_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(sd.code), '{}')
  FROM public.step_definitions sd
  WHERE NOT EXISTS (
    SELECT 1 FROM public.step_completions sc
    WHERE sc.project_id = p_project_id AND sc.step_code = sd.code
  )
  AND NOT EXISTS (
    SELECT 1 FROM unnest(sd.prerequisites) AS prereq
    WHERE prereq NOT IN (
      SELECT sc2.step_code FROM public.step_completions sc2 WHERE sc2.project_id = p_project_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.project_has_active_division(p_project_id UUID, p_division TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.step_definitions sd
    WHERE sd.division = p_division
      AND sd.code = ANY(public.project_active_step_codes(p_project_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        public.is_admin()
        OR p.created_by = auth.uid()
        OR public.project_has_active_division(p.id, public.current_user_division())
        OR EXISTS (
          SELECT 1 FROM public.step_completions sc
          WHERE sc.project_id = p.id AND sc.completed_by = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, division, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'division',
    CASE
      WHEN NEW.raw_user_meta_data->>'division' IS NOT NULL THEN 'active'
      ELSE 'pending'
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mark project completed once ALL steps are done (parallel-flow aware)
CREATE OR REPLACE FUNCTION public.handle_step_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_steps INTEGER;
  done_steps INTEGER;
BEGIN
  SELECT count(*) INTO total_steps FROM public.step_definitions;
  SELECT count(*) INTO done_steps FROM public.step_completions WHERE project_id = NEW.project_id;

  IF done_steps >= total_steps THEN
    UPDATE public.projects SET status = 'completed' WHERE id = NEW.project_id AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_step_completion
  AFTER INSERT ON public.step_completions
  FOR EACH ROW EXECUTE FUNCTION public.handle_step_completion();

-- ---------------------------------------------------------------------------
-- Seed step definitions (32 steps, FASE 1-8, per MOM)
-- ---------------------------------------------------------------------------

INSERT INTO public.step_definitions (code, name, division, stage, sort_order, prerequisites, checklist_items) VALUES
  ('M1', 'PO Customer masuk', 'marketing', 1, 1, '{}', NULL),
  ('M2', 'Approval', 'marketing', 1, 2, '{M1}', NULL),
  ('A1', 'Tagih DP ke customer', 'ar', 1, 3, '{M1}', NULL),
  ('M3', 'Sales Contract ke Pabrik', 'marketing', 1, 4, '{M2}', NULL),
  ('P1', 'Survey', 'project', 1, 5, '{M1}', NULL),
  ('L1', 'PO ke Pabrik', 'logistik', 2, 6, '{A1,M3}', NULL),
  ('F1', 'DP ke Pabrik', 'finance', 2, 7, '{L1}', NULL),
  ('S1', 'Ex Work — konfirmasi tanggal barang siap', 'shipping', 2, 8, '{F1}', NULL),
  ('A2', 'Before Shipment — cek dokumen', 'ar', 3, 9, '{S1}', NULL),
  ('P2', 'Survey MOS — cek lokasi customer', 'project', 3, 10, '{S1}', NULL),
  ('L2', 'Ceklis titip spare part', 'logistik', 4, 11, '{P2}', NULL),
  ('S2', 'Ceklis before shipment', 'shipping', 4, 12, '{P2}', NULL),
  ('S3', 'Cari kapal', 'shipping', 4, 13, '{P2,A2}', NULL),
  ('S4', 'Booking kapal + cek dokumen import & DNP', 'shipping', 4, 14, '{S3,F2}', NULL),
  ('S5', 'Konfirmasi MOS date', 'shipping', 4, 15, '{P2}', NULL),
  ('F2', 'BP — Biaya Pengiriman', 'finance', 4, 16, '{S3}', NULL),
  ('A3', 'Copy B/L', 'ar', 5, 17, '{S4}', NULL),
  ('F3', 'Ship Cost & Insurance', 'finance', 5, 18, '{S4}', NULL),
  ('S6', 'Cek dokumen custom', 'shipping', 5, 19, '{S4}', NULL),
  ('F4', 'PIB — dokumen bea cukai', 'finance', 6, 20, '{S6}', NULL),
  ('P3', 'Persiapan MOS', 'project', 6, 21, '{S5}', ARRAY['Forklift','Truck','Terpal','Triplek']),
  ('P5', 'Persiapan Instalasi', 'project', 6, 22, '{S5}', ARRAY['Subkon','Kos','Steger','Motor','Tiket luar kota']),
  ('P4', 'MOS — Material on Site', 'project', 7, 23, '{F4}', NULL),
  ('A4', 'MOS konfirmasi AR', 'ar', 7, 24, '{P4}', NULL),
  ('P6', 'Instalasi', 'project', 7, 25, '{P4,A4}', NULL),
  ('A5', 'Sangkar pasang', 'ar', 7, 26, '{P6}', NULL),
  ('P7', 'Tescom', 'project', 8, 27, '{A5}', NULL),
  ('A6', 'Tescom konfirmasi AR', 'ar', 8, 28, '{P7}', NULL),
  ('P8', 'BAST 1', 'project', 8, 29, '{A6}', NULL),
  ('A7', 'BAST 1 konfirmasi AR', 'ar', 8, 30, '{P8}', NULL),
  ('P9', 'BAST 2', 'project', 8, 31, '{A7}', NULL),
  ('A8', 'BAST 2 konfirmasi AR', 'ar', 8, 32, '{P9}', NULL);

INSERT INTO public.reminder_config (step_code, enabled, repeat_days, max_repeats, notify_channel)
SELECT code, true, NULL, NULL, 'all' FROM public.step_definitions;

UPDATE public.reminder_config SET repeat_days = 2 WHERE step_code = 'S1';
UPDATE public.reminder_config SET repeat_days = 1 WHERE step_code IN ('A2', 'P2', 'S4', 'F2');

INSERT INTO public.app_config (key, value) VALUES
  ('hogger_days', '5'),
  ('warning_days', '3');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhoc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_active_user());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_active_user())
  WITH CHECK (
    id = auth.uid()
    AND division IS NOT DISTINCT FROM (SELECT division FROM public.profiles WHERE id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
    AND google_calendar_connected IS NOT DISTINCT FROM (
      SELECT google_calendar_connected FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- customers
CREATE POLICY "customers_select_authenticated"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY "customers_insert_authenticated"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY "customers_update_admin"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "customers_delete_admin"
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- step_definitions (reference data; name is admin-editable, everything else read-only)
CREATE POLICY "step_definitions_select_authenticated"
  ON public.step_definitions FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY "step_definitions_update_admin"
  ON public.step_definitions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- projects
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR created_by = auth.uid()
      OR public.project_has_active_division(id, public.current_user_division())
      OR EXISTS (
        SELECT 1 FROM public.step_completions sc
        WHERE sc.project_id = projects.id AND sc.completed_by = auth.uid()
      )
    )
  );

CREATE POLICY "projects_insert_authenticated"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user() AND created_by = auth.uid());

CREATE POLICY "projects_update_admin"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "projects_update_accessible"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(id))
  WITH CHECK (public.is_active_user() AND public.can_access_project(id));

CREATE POLICY "projects_delete_admin"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- app_config
CREATE POLICY "app_config_select_authenticated"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY "app_config_update_admin"
  ON public.app_config FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "app_config_insert_admin"
  ON public.app_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- calendar_events (written via service role; users can read own)
CREATE POLICY "calendar_events_select_own"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- step_completions
CREATE POLICY "step_completions_select"
  ON public.step_completions FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(project_id));

CREATE POLICY "step_completions_insert"
  ON public.step_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND (
      public.is_admin()
      OR (
        completed_by = auth.uid()
        AND step_code = ANY(public.project_active_step_codes(project_id))
        AND (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
        AND NOT EXISTS (
          SELECT 1 FROM public.step_completions sc
          WHERE sc.project_id = step_completions.project_id
            AND sc.step_code = step_completions.step_code
        )
      )
    )
  );

-- reminder_config (read-only for users, admin manages)
CREATE POLICY "reminder_config_select_authenticated"
  ON public.reminder_config FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY "reminder_config_insert_admin"
  ON public.reminder_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "reminder_config_update_admin"
  ON public.reminder_config FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "reminder_config_delete_admin"
  ON public.reminder_config FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- reminder_log (read if project accessible; writes via service role / cron)
CREATE POLICY "reminder_log_select"
  ON public.reminder_log FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(project_id));

-- adhoc_cases (project division + admin)
CREATE POLICY "adhoc_cases_select"
  ON public.adhoc_cases FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR public.can_access_project(project_id)
    )
  );

CREATE POLICY "adhoc_cases_insert"
  ON public.adhoc_cases FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND created_by = auth.uid()
    AND (
      public.is_admin()
      OR public.current_user_division() = 'project'
    )
    AND public.can_access_project(project_id)
  );

CREATE POLICY "adhoc_cases_update"
  ON public.adhoc_cases FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR public.current_user_division() = 'project'
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND (
      public.is_admin()
      OR public.current_user_division() = 'project'
    )
  );

-- followup_schedule
CREATE POLICY "followup_schedule_select"
  ON public.followup_schedule FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(project_id));

CREATE POLICY "followup_schedule_insert"
  ON public.followup_schedule FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND created_by = auth.uid()
    AND public.can_access_project(project_id)
    AND step_code = ANY(public.project_active_step_codes(project_id))
    AND (
      public.is_admin()
      OR (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
    )
  );

CREATE POLICY "followup_schedule_update"
  ON public.followup_schedule FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND (
      public.is_admin()
      OR (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND step_code = ANY(public.project_active_step_codes(project_id))
    AND (
      public.is_admin()
      OR (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
    )
  );

CREATE POLICY "followup_schedule_delete"
  ON public.followup_schedule FOR DELETE
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND (
      public.is_admin()
      OR (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
    )
  );
