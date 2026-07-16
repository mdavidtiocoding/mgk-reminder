-- Run in Supabase SQL Editor if you already deployed add-flow-v2.sql / schema.sql.
-- Adds the missing UPDATE policy on step_definitions so admins can rename
-- steps from Settings → Reminder Config (step_definitions.name column
-- already exists; it just had no UPDATE policy, so RLS silently blocked it).

DROP POLICY IF EXISTS "step_definitions_update_admin" ON public.step_definitions;

CREATE POLICY "step_definitions_update_admin"
  ON public.step_definitions FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
