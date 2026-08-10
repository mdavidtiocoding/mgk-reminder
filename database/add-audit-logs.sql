-- Audit log — who did what (admin-only read).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON public.audit_logs (project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Inserts typically via service role; allow active users as fallback.
DROP POLICY IF EXISTS "audit_logs_insert_active" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_active"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());
