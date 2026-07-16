-- Stores Google Calendar event IDs so we can disable reminders when a step
-- is marked done (event stays on the calendar; popup/alarm stops firing).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL REFERENCES public.step_definitions(code),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('step_unlock', 'followup')),
  reminders_cleared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project_step
  ON public.calendar_events(project_id, step_code);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user
  ON public.calendar_events(user_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Rows are written via service role from the server; authenticated users
-- only need to see their own events (optional, for future UI).
DROP POLICY IF EXISTS "calendar_events_select_own" ON public.calendar_events;
CREATE POLICY "calendar_events_select_own"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
