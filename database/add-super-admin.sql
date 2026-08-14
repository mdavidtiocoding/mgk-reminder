-- Super Admin role
-- Run in Supabase SQL editor after deploy.
--
-- 1) Allow 'super_admin' on profiles.division
-- 2) Treat super_admin as admin in RLS helpers
-- 3) App code merges role_permissions defaults for super_admin column

-- profiles.division CHECK (name may vary by environment)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'profiles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%division%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_division_check
  CHECK (
    division IS NULL
    OR division IN (
      'marketing',
      'ar',
      'logistik',
      'finance',
      'shipping',
      'project',
      'admin',
      'super_admin'
    )
  );

CREATE OR REPLACE FUNCTION public.user_has_division(p_division text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'admin' = ANY(public.user_divisions())
    OR 'super_admin' = ANY(public.user_divisions())
    OR p_division = ANY(public.user_divisions());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
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
        division IN ('admin', 'super_admin')
        OR 'admin' = ANY(divisions)
        OR 'super_admin' = ANY(divisions)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_division()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT d
      FROM unnest(public.user_divisions()) AS d
      WHERE d NOT IN ('admin', 'super_admin')
      LIMIT 1
    ),
    (SELECT division FROM public.profiles WHERE id = auth.uid()),
    (SELECT (public.user_divisions())[1])
  );
$$;
