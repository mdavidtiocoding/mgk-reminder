-- Delay threshold (jam) — global default di app_config, override per step.
-- Run in Supabase SQL editor.

INSERT INTO public.app_config (key, value) VALUES
  ('delay_hours', '12')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS delay_hours INTEGER;

COMMENT ON COLUMN public.step_definitions.delay_hours IS
  'Hours after unlock before this step is Delay. Null = use app_config delay_hours.';
