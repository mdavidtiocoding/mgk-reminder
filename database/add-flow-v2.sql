-- ============================================================================
-- FLOW V2 MIGRATION — New MOM-based workflow (32 code-based steps, DAG/parallel)
-- Run in Supabase Dashboard → SQL Editor, on top of the existing schema.
--
-- !! WARNING — DESTRUCTIVE FOR IN-FLIGHT PROGRESS !!
-- The step flow changed completely (old 22 sequential numbered steps -> new
-- 32 coded steps with parallel branches). Old step_completions / reminder_log /
-- followup_schedule rows reference step NUMBERS that have no equivalent in the
-- new flow, so this migration TRUNCATES those three tables. Existing projects
-- are kept, but every project restarts from the beginning of the new flow
-- (step M1). Back up first if you need the old history.
--
-- Also remaps old divisions on profiles:
--   sales -> marketing, purchasing -> logistik, ap -> finance
--   sales_service -> set to NULL + status 'pending' (needs manual reassignment
--   by admin, since it has no direct equivalent in the new division list)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. step_definitions — mirrors lib/steps.ts, drives RLS + active-step logic
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.step_definitions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  stage INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  prerequisites TEXT[] NOT NULL DEFAULT '{}',
  checklist_items TEXT[]
);

TRUNCATE public.step_definitions;

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

-- ---------------------------------------------------------------------------
-- 2. profiles — new division list + remap old values
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_division_check;

UPDATE public.profiles SET division = 'marketing' WHERE division = 'sales';
UPDATE public.profiles SET division = 'logistik' WHERE division = 'purchasing';
UPDATE public.profiles SET division = 'finance' WHERE division = 'ap';
UPDATE public.profiles SET division = NULL, status = 'pending' WHERE division = 'sales_service';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_division_check CHECK (
  division IS NULL OR division IN (
    'marketing', 'ar', 'logistik', 'finance', 'shipping', 'project', 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- 3. projects — new date fields, drop obsolete current_step
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS ex_work_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS etd_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS eta_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS mos_date DATE;

-- Must drop policies that reference current_step before we can drop the column
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "step_completions_insert" ON public.step_completions;
DROP POLICY IF EXISTS "followup_schedule_insert" ON public.followup_schedule;
DROP POLICY IF EXISTS "followup_schedule_update" ON public.followup_schedule;
DROP POLICY IF EXISTS "followup_schedule_delete" ON public.followup_schedule;

DROP INDEX IF EXISTS idx_projects_current_step;
ALTER TABLE public.projects DROP COLUMN IF EXISTS current_step;

-- ---------------------------------------------------------------------------
-- 4. Reset in-flight progress (old step numbers don't map to new codes)
-- ---------------------------------------------------------------------------

TRUNCATE public.followup_schedule;
TRUNCATE public.reminder_log;
TRUNCATE public.step_completions;

-- step_completions: step_number (INTEGER) -> step_code (TEXT)
ALTER TABLE public.step_completions DROP CONSTRAINT IF EXISTS step_completions_step_number_check;
ALTER TABLE public.step_completions DROP CONSTRAINT IF EXISTS step_completions_project_id_step_number_key;
ALTER TABLE public.step_completions DROP COLUMN IF EXISTS step_number;
ALTER TABLE public.step_completions ADD COLUMN step_code TEXT NOT NULL REFERENCES public.step_definitions(code);
ALTER TABLE public.step_completions ADD CONSTRAINT step_completions_project_id_step_code_key UNIQUE (project_id, step_code);
ALTER TABLE public.step_completions ADD COLUMN IF NOT EXISTS outcome TEXT;

-- reminder_log: step_number (INTEGER) -> step_code (TEXT)
ALTER TABLE public.reminder_log DROP CONSTRAINT IF EXISTS reminder_log_step_number_check;
ALTER TABLE public.reminder_log DROP COLUMN IF EXISTS step_number;
ALTER TABLE public.reminder_log ADD COLUMN step_code TEXT NOT NULL REFERENCES public.step_definitions(code);

-- followup_schedule: step_number (INTEGER) -> step_code (TEXT)
ALTER TABLE public.followup_schedule DROP CONSTRAINT IF EXISTS followup_schedule_step_number_check;
ALTER TABLE public.followup_schedule DROP CONSTRAINT IF EXISTS followup_schedule_project_id_step_number_key;
ALTER TABLE public.followup_schedule DROP COLUMN IF EXISTS step_number;
ALTER TABLE public.followup_schedule ADD COLUMN step_code TEXT NOT NULL REFERENCES public.step_definitions(code);
ALTER TABLE public.followup_schedule ADD CONSTRAINT followup_schedule_project_id_step_code_key UNIQUE (project_id, step_code);

CREATE INDEX IF NOT EXISTS idx_step_completions_project_step ON public.step_completions(project_id, step_code);

-- ---------------------------------------------------------------------------
-- 5. reminder_config — rebuilt for generalized trigger model
--    (the WHEN logic — immediate / after_step / before_date / after_date —
--    lives in code as lib/steps.ts; this table only holds admin-tunable
--    repeat cadence, max repeats and notify channel per step)
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.reminder_config CASCADE;

CREATE TABLE public.reminder_config (
  step_code TEXT PRIMARY KEY REFERENCES public.step_definitions(code),
  enabled BOOLEAN NOT NULL DEFAULT true,
  repeat_days INTEGER,
  max_repeats INTEGER,
  notify_channel TEXT NOT NULL DEFAULT 'all' CHECK (
    notify_channel IN ('all', 'email', 'push', 'calendar')
  )
);

INSERT INTO public.reminder_config (step_code, enabled, repeat_days, max_repeats, notify_channel)
SELECT code, true, NULL, NULL, 'all' FROM public.step_definitions;

-- Seed repeat cadence matching the MOM spec's "@N hari" repeat call-outs
UPDATE public.reminder_config SET repeat_days = 2 WHERE step_code = 'S1';
UPDATE public.reminder_config SET repeat_days = 1 WHERE step_code IN ('A2', 'P2', 'S4', 'F2');

-- ---------------------------------------------------------------------------
-- 6. Helper functions — active-step / division access based on the DAG
-- ---------------------------------------------------------------------------

-- CASCADE also drops the old policies still referencing step_division();
-- section 8 below recreates all of them against the new DAG-based functions.
DROP FUNCTION IF EXISTS public.step_division(INTEGER) CASCADE;

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
-- 7. Trigger — mark project completed once ALL 32 steps are done
--    (replaces the old linear "advance current_step" trigger)
-- ---------------------------------------------------------------------------

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
-- (trigger "on_step_completion" already points at this function — no need to recreate it)

-- ---------------------------------------------------------------------------
-- 8. RLS policy updates (drop + recreate the ones tied to current_step/step_number)
-- ---------------------------------------------------------------------------

ALTER TABLE public.step_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_definitions_select_authenticated" ON public.step_definitions;
CREATE POLICY "step_definitions_select_authenticated"
  ON public.step_definitions FOR SELECT
  TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "projects_select" ON public.projects;
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

DROP POLICY IF EXISTS "step_completions_insert" ON public.step_completions;
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

DROP POLICY IF EXISTS "followup_schedule_insert" ON public.followup_schedule;
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

DROP POLICY IF EXISTS "followup_schedule_update" ON public.followup_schedule;
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

DROP POLICY IF EXISTS "followup_schedule_delete" ON public.followup_schedule;
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

-- reminder_config policies (table was dropped/recreated, needs RLS re-enabled)
ALTER TABLE public.reminder_config ENABLE ROW LEVEL SECURITY;

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

-- ---------------------------------------------------------------------------
-- Done. New projects (and existing ones, reset) now start at step M1.
-- ---------------------------------------------------------------------------
