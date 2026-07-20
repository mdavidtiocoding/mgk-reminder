-- ============================================================================
-- SUB-STEPS — configurable multi-action steps (A1, M3, etc.)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS substeps JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.step_definitions.substeps IS
  'Ordered sub-actions: [{ "key": "tagih", "label": "Sudah ditagih", "sort_order": 1 }, ...]';

-- ---------------------------------------------------------------------------
-- Sub-step completions (per project)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.step_substep_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  substep_key TEXT NOT NULL,
  completed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  UNIQUE (project_id, step_code, substep_key)
);

CREATE INDEX IF NOT EXISTS idx_step_substep_completions_project
  ON public.step_substep_completions(project_id);

CREATE INDEX IF NOT EXISTS idx_step_substep_completions_project_step
  ON public.step_substep_completions(project_id, step_code);

ALTER TABLE public.step_substep_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_substep_completions_select" ON public.step_substep_completions;
CREATE POLICY "step_substep_completions_select"
  ON public.step_substep_completions FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(project_id));

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
        AND (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
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
      OR (
        completed_by = auth.uid()
        AND (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
      )
    )
  );

-- Allow undo on full step completion (admin or original completer)
DROP POLICY IF EXISTS "step_completions_delete" ON public.step_completions;
CREATE POLICY "step_completions_delete"
  ON public.step_completions FOR DELETE
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR (
        completed_by = auth.uid()
        AND (SELECT division FROM public.step_definitions WHERE code = step_code) = public.current_user_division()
      )
    )
  );

-- Allow admin to update substeps column
DROP POLICY IF EXISTS "step_definitions_update_admin" ON public.step_definitions;
CREATE POLICY "step_definitions_update_admin"
  ON public.step_definitions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Default sub-steps for A1 and M3
UPDATE public.step_definitions
SET substeps = '[
  {"key": "tagih", "label": "Sudah ditagih", "sort_order": 1},
  {"key": "received", "label": "Pembayaran sudah diterima", "sort_order": 2}
]'::jsonb
WHERE code = 'A1';

UPDATE public.step_definitions
SET substeps = '[
  {"key": "sent", "label": "Sudah terkirim", "sort_order": 1},
  {"key": "received", "label": "Sudah diterima", "sort_order": 2}
]'::jsonb
WHERE code = 'M3';
