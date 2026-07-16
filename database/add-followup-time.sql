-- Add scheduled time to follow-up (run in Supabase SQL Editor)

ALTER TABLE public.followup_schedule
  ADD COLUMN IF NOT EXISTS scheduled_time TIME NOT NULL DEFAULT '09:00:00';
