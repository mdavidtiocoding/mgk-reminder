# Cursor Task — Flow Config Page (Step Prerequisites & Trigger Viewer)

## Goal

Build a new **admin-only settings page** at `/settings/flow` that lets the admin search all 32 steps and configure:
1. **Prerequisites** — which steps must be completed before this step unlocks (stored in `step_definitions.prerequisites` in Supabase)
2. **Step name** — rename the step (same as existing reminder-config name edit, but here inline)
3. **Trigger description** — read-only display of when the reminder fires (computed from `lib/steps.ts` `describeTrigger()`)

---

## Existing context you must understand

### `lib/steps.ts`
All 32 step definitions (code, name, division, stage, prerequisites, trigger). The `describeTrigger(step)` function returns a human-readable string. Use this for the read-only trigger column.

### `step_definitions` table in Supabase
Columns: `code`, `name`, `division`, `stage`, `sort_order`, `prerequisites TEXT[]`, `checklist_items TEXT[]`

The `prerequisites` column is the source of truth for what unlocks each step at runtime (used by `complete-step.ts`). Names can already be updated (UPDATE policy exists via `add-step-name-edit.sql`).

### Existing settings pages
- `/settings` — main settings hub, has a card linking to `/settings/reminders`
- `/settings/reminders` — reminder config (admin only), see `app/settings/reminders/page.tsx` for pattern to follow for `requireAdmin()`, Supabase reads, and layout

---

## What to build

### 1. SQL migration — `database/add-flow-config-update.sql`

```sql
-- Allow admin to update prerequisites and name on step_definitions
-- (name update policy may already exist from add-step-name-edit.sql — use IF NOT EXISTS / DROP IF EXISTS pattern)

DROP POLICY IF EXISTS "step_definitions_update_admin" ON public.step_definitions;

CREATE POLICY "step_definitions_update_admin"
  ON public.step_definitions FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
```

### 2. New page — `app/settings/flow/page.tsx`

Server component (same pattern as `app/settings/reminders/page.tsx`):
- Call `requireAdmin()`
- Fetch all rows from `step_definitions` (code, name, division, stage, sort_order, prerequisites)
- Import `STEPS` from `lib/steps.ts` to get `describeTrigger()` and compute `unlocksSteps` (reverse lookup: which steps list this code in their prerequisites)
- Build the combined data array sorted by `sort_order`
- Render `<FlowConfigTable>` client component

### 3. Client component — `components/settings/flow-config-table.tsx`

Props:
```ts
type FlowConfigRow = {
  code: string
  name: string
  division: string
  stage: number
  prerequisites: string[]    // from DB
  triggerDescription: string // from describeTrigger()
  unlocksSteps: string[]     // computed reverse lookup: steps that have this code in their prerequisites
}

type AllStepOptions = { code: string; name: string }[] // for the prerequisites multi-select picker
```

#### Features:

**Search bar** — filter rows by code, name, or division (client-side, instant)

**Table columns:**
| Code | Nama Step | Divisi | Tahap | Prerequisites (harus selesai dulu) | Memicu Step | Trigger Reminder |
|------|-----------|--------|-------|-------------------------------------|-------------|-----------------|
| M1   | Penerimaan PO... | Marketing | 1 | — | M2, A1, P1 | Segera saat step unlock |

- **Prerequisites** column: show as comma-separated badges. Click the edit icon → opens an inline popover/dialog with a multi-select checkbox list of ALL step codes (grouped by tahap). On save, call a server action.
- **Memicu Step** ("Unlocks" column): read-only, shows which steps this one directly enables (reverse lookup). Displayed as badges.
- **Trigger Reminder**: read-only text from `describeTrigger()`

#### Server action — `app/actions/flow-config.ts`

```ts
"use server"

export async function updateStepPrerequisites(
  stepCode: string,
  prerequisites: string[]
): Promise<{ success: true } | { success: false; error: string }>
```

- Call `requireAdmin()` 
- Validate: each code in prerequisites must exist in step_definitions
- Validate: no circular dependency (a step cannot list itself or create a cycle — simple check: stepCode not in prerequisites)
- Update `step_definitions` SET `prerequisites = $prerequisites` WHERE `code = $stepCode`
- Return success/error

### 4. Add link to `/settings` main page

In `app/settings/page.tsx`, add a new card (same style as existing cards) linking to `/settings/flow`:
- Title: "Konfigurasi Flow Step"
- Description: "Atur prasyarat (prerequisites) setiap step — step apa yang harus selesai sebelum step ini bisa aktif."
- Icon: something like `GitBranch` or `Workflow` from lucide-react

---

## UI / UX notes

- The prerequisites multi-select popover should show ALL 32 steps grouped by Tahap, with checkboxes. Currently selected ones pre-checked.
- Show a warning if the user removes all prerequisites from a non-M1 step (it will auto-activate on project creation like M1).
- After save, call `router.refresh()` to update the table.
- Keep the same page layout as `/settings/reminders`: AppHeader + back button + card.
- No skeleton loader needed — server renders the initial data.

---

## Files to create/edit

- CREATE: `database/add-flow-config-update.sql`
- CREATE: `app/settings/flow/page.tsx`
- CREATE: `components/settings/flow-config-table.tsx`
- CREATE: `app/actions/flow-config.ts`
- EDIT: `app/settings/page.tsx` — add flow config card

---

## Do NOT change

- `lib/steps.ts` — the trigger logic stays hardcoded there for now
- `app/actions/complete-step.ts` — prerequisite checking logic stays as-is (reads from DB `step_definitions.prerequisites` already)
- `/settings/reminders` page — separate concern
