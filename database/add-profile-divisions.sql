-- Multi-division profiles: allow one user to belong to multiple divisions.
-- Run in Supabase SQL Editor after existing migrations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS divisions TEXT[] NOT NULL DEFAULT '{}';

-- Backfill from legacy single `division` column
UPDATE public.profiles
SET divisions = ARRAY[division]
WHERE division IS NOT NULL
  AND (divisions IS NULL OR divisions = '{}');

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_divisions()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Union of divisions[] + legacy division so admin is not lost if one side is stale
  SELECT COALESCE(
    (
      SELECT array_agg(DISTINCT d)
      FROM (
        SELECT unnest(COALESCE(p.divisions, '{}'::TEXT[])) AS d
        FROM public.profiles p
        WHERE p.id = auth.uid()
        UNION
        SELECT p.division
        FROM public.profiles p
        WHERE p.id = auth.uid() AND p.division IS NOT NULL
      ) s
      WHERE d IS NOT NULL AND d <> ''
    ),
    '{}'::TEXT[]
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_division(p_division TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'admin' = ANY(public.user_divisions())
    OR p_division = ANY(public.user_divisions());
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
    WHERE id = auth.uid()
      AND status = 'active'
      AND (
        division = 'admin'
        OR 'admin' = ANY(divisions)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_division()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT d
      FROM unnest(public.user_divisions()) AS d
      WHERE d <> 'admin'
      LIMIT 1
    ),
    (SELECT division FROM public.profiles WHERE id = auth.uid()),
    (SELECT (public.user_divisions())[1])
  );
$$;

CREATE OR REPLACE FUNCTION public.project_has_active_division_for_user(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(public.user_divisions()) AS d
    WHERE public.project_has_active_division(p_project_id, d)
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
        OR public.project_has_active_division_for_user(p.id)
        OR EXISTS (
          SELECT 1 FROM public.step_completions sc
          WHERE sc.project_id = p.id AND sc.completed_by = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policy updates (multi-division aware)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR created_by = auth.uid()
      OR public.project_has_active_division_for_user(id)
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
        AND public.user_has_division(
          (SELECT division FROM public.step_definitions WHERE code = step_code)
        )
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
    AND public.user_has_division(
      (SELECT division FROM public.step_definitions WHERE code = step_code)
    )
  );

DROP POLICY IF EXISTS "followup_schedule_update" ON public.followup_schedule;
CREATE POLICY "followup_schedule_update"
  ON public.followup_schedule FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND public.user_has_division(
      (SELECT division FROM public.step_definitions WHERE code = step_code)
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND step_code = ANY(public.project_active_step_codes(project_id))
    AND public.user_has_division(
      (SELECT division FROM public.step_definitions WHERE code = step_code)
    )
  );

DROP POLICY IF EXISTS "followup_schedule_delete" ON public.followup_schedule;
CREATE POLICY "followup_schedule_delete"
  ON public.followup_schedule FOR DELETE
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND public.user_has_division(
      (SELECT division FROM public.step_definitions WHERE code = step_code)
    )
  );

-- step_substep_completions (from add-substeps.sql) — only if table exists
DO $$
BEGIN
  IF to_regclass('public.step_substep_completions') IS NULL THEN
    RAISE NOTICE 'step_substep_completions belum ada — skip policy multi-divisi untuk sub-step';
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "step_substep_completions_insert" ON public.step_substep_completions;
  CREATE POLICY "step_substep_completions_insert"
    ON public.step_substep_completions FOR INSERT
    TO authenticated
    WITH CHECK (
      public.is_active_user()
      AND (
        public.is_admin()
        OR (
          completed_by = auth.uid()
          AND step_code = ANY(public.project_active_step_codes(project_id))
          AND public.user_has_division(
            (SELECT division FROM public.step_definitions WHERE code = step_code)
          )
        )
      )
    );

  DROP POLICY IF EXISTS "step_substep_completions_update" ON public.step_substep_completions;
  CREATE POLICY "step_substep_completions_update"
    ON public.step_substep_completions FOR UPDATE
    TO authenticated
    USING (
      public.is_active_user()
      AND (
        public.is_admin()
        OR public.user_has_division(
          (SELECT division FROM public.step_definitions WHERE code = step_code)
        )
      )
    )
    WITH CHECK (
      public.is_active_user()
      AND (
        public.is_admin()
        OR public.user_has_division(
          (SELECT division FROM public.step_definitions WHERE code = step_code)
        )
      )
    );

  DROP POLICY IF EXISTS "step_substep_completions_delete" ON public.step_substep_completions;
  CREATE POLICY "step_substep_completions_delete"
    ON public.step_substep_completions FOR DELETE
    TO authenticated
    USING (
      public.is_active_user()
      AND (
        public.is_admin()
        OR public.user_has_division(
          (SELECT division FROM public.step_definitions WHERE code = step_code)
        )
      )
    );
END $$;

-- profiles_update_own: users cannot change divisions themselves
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND division IS NOT DISTINCT FROM (SELECT division FROM public.profiles WHERE id = auth.uid())
    AND divisions IS NOT DISTINCT FROM (SELECT divisions FROM public.profiles WHERE id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
    AND google_calendar_connected IS NOT DISTINCT FROM (
      SELECT google_calendar_connected FROM public.profiles WHERE id = auth.uid()
    )
  );
