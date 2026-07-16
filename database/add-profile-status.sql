-- Migration: add profile status + tighten RLS for pending users
-- Run in Supabase Dashboard → SQL Editor (after schema.sql)

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ALTER COLUMN division DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_division_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_division_check CHECK (
    division IS NULL OR division IN (
      'sales', 'ar', 'purchasing', 'ap', 'shipping',
      'project', 'finance', 'sales_service', 'admin'
    )
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (
    status IN ('pending', 'active', 'suspended')
  );

-- Existing users created before self-registration should remain active
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- RLS policy updates
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_active_user());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_active_user())
  WITH CHECK (
    id = auth.uid()
    AND division IS NOT DISTINCT FROM (SELECT division FROM public.profiles WHERE id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;
CREATE POLICY "customers_select_authenticated"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "customers_insert_authenticated" ON public.customers;
CREATE POLICY "customers_insert_authenticated"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR created_by = auth.uid()
      OR public.step_division(current_step) = public.current_user_division()
      OR EXISTS (
        SELECT 1 FROM public.step_completions sc
        WHERE sc.project_id = projects.id AND sc.completed_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "projects_insert_authenticated" ON public.projects;
CREATE POLICY "projects_insert_authenticated"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS "step_completions_select" ON public.step_completions;
CREATE POLICY "step_completions_select"
  ON public.step_completions FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(project_id));

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
        AND step_number = (
          SELECT current_step FROM public.projects WHERE id = project_id
        )
        AND public.step_division(step_number) = public.current_user_division()
        AND NOT EXISTS (
          SELECT 1 FROM public.step_completions sc
          WHERE sc.project_id = step_completions.project_id
            AND sc.step_number = step_completions.step_number
        )
      )
    )
  );

DROP POLICY IF EXISTS "reminder_config_select_authenticated" ON public.reminder_config;
CREATE POLICY "reminder_config_select_authenticated"
  ON public.reminder_config FOR SELECT
  TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "reminder_log_select" ON public.reminder_log;
CREATE POLICY "reminder_log_select"
  ON public.reminder_log FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND public.can_access_project(project_id));

DROP POLICY IF EXISTS "adhoc_cases_select" ON public.adhoc_cases;
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

DROP POLICY IF EXISTS "adhoc_cases_insert" ON public.adhoc_cases;
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

DROP POLICY IF EXISTS "adhoc_cases_update" ON public.adhoc_cases;
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

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_active_user() AND user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own"
  ON public.push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user() AND user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own"
  ON public.push_subscriptions FOR UPDATE
  TO authenticated
  USING (public.is_active_user() AND user_id = auth.uid())
  WITH CHECK (public.is_active_user() AND user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own"
  ON public.push_subscriptions FOR DELETE
  TO authenticated
  USING (public.is_active_user() AND user_id = auth.uid());
