-- Optional business date per sub-step (e.g. tanggal tagihan vs waktu klik di app)
ALTER TABLE public.step_substep_completions
  ADD COLUMN IF NOT EXISTS event_date DATE;

COMMENT ON COLUMN public.step_substep_completions.event_date IS
  'Optional business date (e.g. invoice date). completed_at remains the submit timestamp.';
