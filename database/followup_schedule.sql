-- Follow-up scheduling (run in Supabase SQL Editor after schema.sql)

CREATE TABLE IF NOT EXISTS public.followup_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 22),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL DEFAULT '09:00:00',
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  UNIQUE (project_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_followup_schedule_project_id
  ON public.followup_schedule(project_id);

CREATE INDEX IF NOT EXISTS idx_followup_schedule_due
  ON public.followup_schedule(scheduled_date)
  WHERE notified_at IS NULL;

ALTER TABLE public.followup_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "followup_schedule_select" ON public.followup_schedule;
DROP POLICY IF EXISTS "followup_schedule_insert" ON public.followup_schedule;
DROP POLICY IF EXISTS "followup_schedule_update" ON public.followup_schedule;
DROP POLICY IF EXISTS "followup_schedule_delete" ON public.followup_schedule;

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
    AND step_number = (
      SELECT current_step FROM public.projects WHERE id = project_id
    )
    AND (
      public.is_admin()
      OR public.step_division(step_number) = public.current_user_division()
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
      OR public.step_division(step_number) = public.current_user_division()
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND step_number = (
      SELECT current_step FROM public.projects WHERE id = project_id
    )
    AND (
      public.is_admin()
      OR public.step_division(step_number) = public.current_user_division()
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
      OR public.step_division(step_number) = public.current_user_division()
    )
  );
