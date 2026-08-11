-- Note relay: on mark-done, ask Ada/Tidak; if Ada, require notes + pick a next step.
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.

ALTER TABLE public.step_definitions
  ADD COLUMN IF NOT EXISTS note_route_config JSONB;

COMMENT ON COLUMN public.step_definitions.note_route_config IS
  'If enabled, mark-done asks Ada/Tidak. If Ada, user writes notes and picks a target step. Shape: { "enabled": true, "targets": ["S2","P2"] }';

ALTER TABLE public.step_completions
  ADD COLUMN IF NOT EXISTS note_route_presence TEXT,
  ADD COLUMN IF NOT EXISTS note_route_to TEXT,
  ADD COLUMN IF NOT EXISTS note_route_message TEXT;

COMMENT ON COLUMN public.step_completions.note_route_presence IS
  'ada | tidak — set when the completed step has note_route_config.enabled';
COMMENT ON COLUMN public.step_completions.note_route_to IS
  'Destination step code when presence = ada';
COMMENT ON COLUMN public.step_completions.note_route_message IS
  'Notes forwarded to note_route_to';
