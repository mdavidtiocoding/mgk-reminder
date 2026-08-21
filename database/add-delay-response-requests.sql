-- Delay response: admin push → divisi isi alasan + minta waktu → admin approve.
-- Run in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.delay_response_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  status TEXT NOT NULL CHECK (
    status IN (
      'awaiting_division',
      'awaiting_approval',
      'approved',
      'rejected',
      'cancelled'
    )
  ),
  pushed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  admin_note TEXT,
  pushed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  requested_until DATE,
  responded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  approved_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delay_response_open_unique
  ON public.delay_response_requests (project_id, step_code)
  WHERE status IN ('awaiting_division', 'awaiting_approval');

CREATE INDEX IF NOT EXISTS idx_delay_response_project
  ON public.delay_response_requests (project_id);

CREATE INDEX IF NOT EXISTS idx_delay_response_status
  ON public.delay_response_requests (status);

COMMENT ON TABLE public.delay_response_requests IS
  'Admin minta response delay; divisi isi alasan + sampai kapan; admin approve.';

ALTER TABLE public.delay_response_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delay_response_select" ON public.delay_response_requests;
DROP POLICY IF EXISTS "delay_response_insert" ON public.delay_response_requests;
DROP POLICY IF EXISTS "delay_response_update" ON public.delay_response_requests;

CREATE POLICY "delay_response_select"
  ON public.delay_response_requests FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_access_project(project_id)
  );

CREATE POLICY "delay_response_insert"
  ON public.delay_response_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND public.is_admin()
    AND pushed_by = auth.uid()
    AND public.can_access_project(project_id)
  );

CREATE POLICY "delay_response_update"
  ON public.delay_response_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND (
      public.is_admin()
      OR public.user_has_division(
        (SELECT division FROM public.step_definitions WHERE code = step_code)
      )
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND public.can_access_project(project_id)
    AND (
      public.is_admin()
      OR public.user_has_division(
        (SELECT division FROM public.step_definitions WHERE code = step_code)
      )
    )
  );
