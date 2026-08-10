-- Expose BAST 1 / BAST 2 choice in Flow Config (step_definitions.bast_choice).
-- Safe to re-run. Also covered by add-trigger-and-bast-config.sql (bottom).

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS bast_choice BOOLEAN;

COMMENT ON COLUMN public.step_definitions.bast_choice IS
  'If true, mark-done asks BAST 1 only vs BAST 1+2 (and can auto-skip P9/A8).';

UPDATE public.step_definitions
SET bast_choice = true
WHERE code = 'P8' AND bast_choice IS NULL;
