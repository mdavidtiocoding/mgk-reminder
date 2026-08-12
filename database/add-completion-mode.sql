-- Mode Selesai — configurable mark-as-done behavior per step
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS completion_mode TEXT NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN public.step_definitions.completion_mode IS
  'How mark-as-done works: normal | checklist | checklist_keterangan';

-- Seed existing checklist steps
UPDATE public.step_definitions
SET completion_mode = 'checklist'
WHERE checklist_items IS NOT NULL
  AND array_length(checklist_items, 1) > 0
  AND completion_mode = 'normal';
