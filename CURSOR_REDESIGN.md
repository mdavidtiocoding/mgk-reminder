# Cursor Task — Premium UI Redesign

## Goal
Redesign the app to look like a modern premium SaaS internal tool (think Linear, Vercel dashboard, Supabase). Keep all existing functionality 100% intact — only change visual design and layout structure.

---

## 1. New Layout — Sidebar Navigation

Replace the current `AppHeader` top-bar approach with a **sidebar + main content** layout.

### New root layout structure (`app/layout.tsx` or a new `components/layout/app-layout.tsx`)
```
┌──────────────────────────────────────────────────────┐
│  SIDEBAR (fixed, 220px wide, full height)            │
│  ┌────────────────────────────────────────────────┐  │
│  │  MGK                                           │  │
│  │  Flow Reminder           [logo area]           │  │
│  ├────────────────────────────────────────────────┤  │
│  │  ◉ Dashboard                                  │  │
│  │  ◉ My Tasks              [4]  (badge count)   │  │
│  ├────────────────────────────────────────────────┤  │
│  │  (bottom)                                      │  │
│  │  ◉ Settings                                   │  │
│  │  ──────────────────                           │  │
│  │  [Division badge]                              │  │
│  │  Josh · Admin                                  │  │
│  │  [Keluar button]                               │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  MAIN CONTENT (flex-1, scrollable)                   │
│  ┌────────────────────────────────────────────────┐  │
│  │  Page content here                             │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Sidebar design specs:
- Background: `bg-sidebar` (use shadcn sidebar component if available, otherwise `bg-zinc-950` dark sidebar or `bg-white border-r border-border` light sidebar — use light/white to match existing theme)
- Logo area: "MGK" in bold + "Flow Reminder" smaller, with a small colored square icon
- Nav items: full-width button, active state = `bg-primary/10 text-primary font-medium`, inactive = `text-muted-foreground hover:text-foreground hover:bg-muted`
- Outstanding badge on My Tasks: red circle like current implementation
- Bottom section pinned to bottom: user name, division badge, keluar button
- On mobile: sidebar collapses (hamburger menu or just stacks on top)

### File changes needed:
- EDIT `components/layout/app-header.tsx` → refactor into `AppSidebar` component (or rename file)
- EDIT every page that uses `<AppHeader>` to use new sidebar layout:
  - `app/page.tsx` (dashboard)
  - `app/projects/[id]/page.tsx`
  - `app/tasks/page.tsx`
  - `app/settings/page.tsx`
  - `app/settings/reminders/page.tsx`
  - `app/settings/flow/page.tsx` (new)
  - Any other page that renders AppHeader

The cleanest approach: create a `components/layout/app-shell.tsx` client component that renders the sidebar + wraps children. Pages that need auth just wrap their content in `<AppShell userName={...} division={...}>`.

---

## 2. Dashboard Page Redesign

### Stats bar at top
Add a row of 3 stat cards above the project list:

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  12              │ │  4               │ │  2               │
│  Total Project   │ │  My Tasks        │ │  Hogger          │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Compute from `projects` array already fetched. "My Tasks" = count of projects where user's division has an active step.

### Project card redesign
Current: basic shadcn Card
New design:

```
┌─────────────────────────────────────────────────────┐
│  [Division color left border 4px]                    │
│  Project Name                        [HOGGER badge]  │
│  Customer Name · Tahap 3/8                          │
│  ─────────────────────────────────────────          │
│  [Progress bar full width]                           │
│  ─────────────────────────────────────────          │
│  M3 — Pengiriman Sales Contract    [Marketing]       │
│  P1 — Survey Lokasi Customer       [Project]         │
│                                                      │
│  Delay 3 hari                                        │
└─────────────────────────────────────────────────────┘
```

- Remove card outer shadow, use `border` only
- Left border accent colored by division of first active step (`DIVISION_BADGE_STYLES`)
- If multiple active steps with different divisions, use `border-l-primary`
- Hover: `hover:shadow-md hover:border-primary/30 transition-all`
- Status badge (Aktif/Selesai/Ditahan) shown as subtle chip top-right
- Customer + Tahap on same line below project name
- Dividers between sections
- Division label shown as small colored badge next to step name

---

## 3. Project Detail Page Redesign

### Page header — full colored hero
Replace current plain text header with a colored hero band:

```
┌────────────────────────────────────────────────────────────────┐
│  bg-gradient-to-r from-zinc-900 to-zinc-800 (or primary dark)  │
│  ← Kembali                                                     │
│                                                                │
│  Nama Project                              [Status badge]      │
│  Customer: PT ABC · Mulai 12 Jan 2026     [Edit] [Hold] [...] │
└────────────────────────────────────────────────────────────────┘
```

Or lighter alternative: `bg-muted/50 border-b` with the project name prominent. Either is fine, just make it clearly a page header section visually distinct from content.

- Project name: `text-2xl font-bold`
- Meta info (customer, date) in muted small text
- Action buttons (edit, on-hold, delete) grouped right
- Status badge prominent

### Stage progress bar
Keep existing functionality but style improvements:
- Make the progress stepper more visual — current stage circle should pulse or have a ring animation
- Stage labels below circles should truncate gracefully
- Overall container: cleaner, maybe no border just subtle background

### Step timeline (stage slider)
The horizontal stage tabs (pill buttons) added recently — style them better:
- Make the tab row look like proper segmented control / tab bar
- Active tab: more prominent, maybe has a bottom border indicator instead of filled background
- Or keep filled but use a proper tab component

---

## 4. General Polish

- All page `<main>` max-width containers: `max-w-5xl` (slightly wider than current `max-w-4xl`)
- Page section headings: add a subtle divider or more spacing
- Empty states: if no projects, show a proper empty state illustration (SVG inline) with a "+ Tambah Project" button
- Loading states: add `loading.tsx` skeleton files for dashboard and project detail if they don't exist
- Smooth transitions on interactive elements: ensure all buttons/cards have `transition-colors duration-150`

---

## Design tokens / color palette to use
Stay within the existing shadcn theme. Do NOT introduce new CSS variables. Use:
- `bg-background`, `bg-card`, `bg-muted`, `bg-primary`
- `text-foreground`, `text-muted-foreground`, `text-primary`
- `border`, `border-primary`
- Division colors from `DIVISION_BADGE_STYLES` (already defined in `lib/steps.ts`)

---

## What NOT to change
- All server actions, data fetching logic, Supabase queries
- `lib/steps.ts`, `lib/projects/`, `lib/auth/`
- Dialog components (MarkDoneDialog, SetFollowUpDialog) — keep as-is
- Any `app/actions/` files
- The step-timeline.tsx slide pagination logic (keep the horizontal stage navigation)
- Authentication flow

---

## Priority order
1. Sidebar layout (biggest impact)
2. Project card redesign
3. Project detail page header
4. Stats bar on dashboard
5. General polish
