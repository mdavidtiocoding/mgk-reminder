-- Optional: document sub-step kind field in JSONB substeps column.
-- No schema change required — kind is stored inside each sub-step object:
-- { "key": "received", "label": "Pembayaran diterima", "sort_order": 2, "kind": "reminder" }
--
-- kind values:
--   required  (default) — must complete before next step unlocks
--   reminder          — self-reminder only, does not block unlock

COMMENT ON COLUMN public.step_definitions.substeps IS
  'Ordered sub-actions: [{ "key", "label", "sort_order", "kind": "required"|"reminder" }, ...]';
