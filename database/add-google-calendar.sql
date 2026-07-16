-- Google Calendar integration (run in Supabase SQL Editor)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN NOT NULL DEFAULT false;

-- Prevent users from toggling Google connection via profile self-update
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_active_user())
  WITH CHECK (
    id = auth.uid()
    AND division IS NOT DISTINCT FROM (SELECT division FROM public.profiles WHERE id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT status FROM public.profiles WHERE id = auth.uid())
    AND google_calendar_connected IS NOT DISTINCT FROM (
      SELECT google_calendar_connected FROM public.profiles WHERE id = auth.uid()
    )
  );
