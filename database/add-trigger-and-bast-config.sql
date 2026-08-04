-- Editable step triggers + outcome flags (Flow Config without code changes).
-- Run in Supabase SQL Editor.

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS trigger_config JSONB;

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS has_outcome BOOLEAN;

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS outcome_reschedule_field TEXT;

-- Project-level: whether BAST 2 applies (null = not decided yet / default both)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS bast2_required BOOLEAN;

COMMENT ON COLUMN public.step_definitions.trigger_config IS
  'Override for step trigger (immediate/interval/after_step/before_date/after_date). Null = use code default.';

COMMENT ON COLUMN public.projects.bast2_required IS
  'Set when completing BAST 1 (P8). false = skip P9/A8; true = keep BAST 2 flow.';

-- Seed useful defaults (safe to re-run)
UPDATE public.step_definitions
SET trigger_config = '{"type":"before_date","dateField":"eta_date","offsetDays":3,"repeatDays":1}'::jsonb
WHERE code = 'S5'
  AND trigger_config IS NULL;

UPDATE public.step_definitions
SET
  has_outcome = true,
  outcome_reschedule_field = 'etd_date'
WHERE code = 'S4';

UPDATE public.step_definitions
SET
  has_outcome = true,
  outcome_reschedule_field = 'mos_date',
  prerequisites = ARRAY['P2','S4']
WHERE code = 'S5';

UPDATE public.step_definitions
SET checklist_items = ARRAY['Subkon: Ya/Tidak','Kos','Steger','Motor','Tiket luar kota']
WHERE code = 'P5';
