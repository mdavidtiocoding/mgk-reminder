-- App-wide tunable settings (hogger / warning thresholds, etc.)
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.app_config (key, value) VALUES
  ('hogger_days', '5'),
  ('warning_days', '3')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_select_authenticated" ON public.app_config;
CREATE POLICY "app_config_select_authenticated"
  ON public.app_config FOR SELECT
  TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "app_config_update_admin" ON public.app_config;
CREATE POLICY "app_config_update_admin"
  ON public.app_config FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "app_config_insert_admin" ON public.app_config;
CREATE POLICY "app_config_insert_admin"
  ON public.app_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Allow admins to delete projects (edit/status already covered by projects_update_admin)
DROP POLICY IF EXISTS "projects_delete_admin" ON public.projects;
CREATE POLICY "projects_delete_admin"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Allow any active user who can access a project to update name/customer
-- (status changes are still enforced as admin-only in server actions)
DROP POLICY IF EXISTS "projects_update_accessible" ON public.projects;
CREATE POLICY "projects_update_accessible"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(id))
  WITH CHECK (public.is_active_user() AND public.can_access_project(id));
