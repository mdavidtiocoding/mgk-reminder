-- Document per-sub-step checklist in JSONB (no new column).
-- Shape:
-- {
--   "key": "survey",
--   "label": "Survey lokasi",
--   "sort_order": 1,
--   "kind": "required",
--   "checklist_items": ["Foto site", "Form survey"]
-- }
-- Completing a sub-step requires its checklist (if any) first.
-- The next required sub-step stays locked until the previous one is done.

COMMENT ON COLUMN public.step_definitions.substeps IS
  'Ordered sub-actions: [{ "key", "label", "sort_order", "kind": "required"|"reminder", "checklist_items"?: string[] }, ...]';
