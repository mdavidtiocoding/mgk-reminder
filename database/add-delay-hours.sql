-- Delay threshold (jam) — global default di app_config, override per step.
-- Run in Supabase SQL editor.

INSERT INTO public.app_config (key, value) VALUES
  ('delay_hours', '24')
ON CONFLICT (key) DO NOTHING;

-- If previous default 12 was never customized, move to 1×24 jam.
UPDATE public.app_config
SET value = '24'
WHERE key = 'delay_hours' AND value = '12';

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS delay_hours INTEGER;

COMMENT ON COLUMN public.step_definitions.delay_hours IS
  'Hours after unlock before this step is Delay. Null = use app_config delay_hours.';
