-- ============================================================================
-- FLOW CONFIG — Allow admin to update prerequisites on step_definitions
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

-- Allow admin to update prerequisites (and name) on step_definitions
DROP POLICY IF EXISTS "step_definitions_update_admin" ON public.step_definitions;

CREATE POLICY "step_definitions_update_admin"
  ON public.step_definitions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
