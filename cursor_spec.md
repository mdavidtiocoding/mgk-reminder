# MGK Flow Reminder — Cursor Spec

## Overview

Build a **web-based workflow tracker + reminder system** for an internal company team.
The app tracks projects through a fixed sequence of steps across multiple divisions.
Each step is "completed" by the responsible person clicking done (with timestamp + optional note).
If a step is stuck, it's visible on the dashboard who hasn't acted yet ("hogger").

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database + Auth:** Supabase (PostgreSQL + Supabase Auth)
- **Styling:** Tailwind CSS + shadcn/ui
- **Notifications:** 
  - Email via Resend
  - Browser push notifications (Web Push API / service worker)
  - Google Calendar integration (Google Calendar API)
- **Scheduler (cron jobs):** Supabase Edge Functions (scheduled)
- **Deploy:** Railway or Vercel Pro

---

## User Roles & Divisions

Each user belongs to one division. Divisions:
- `sales`
- `ar` (Finance AR)
- `purchasing`
- `ap` (Finance AP)
- `shipping`
- `project`
- `finance`
- `sales_service`
- `admin` (can see everything, manage users, configure settings)

Users have:
- Name
- Email
- Division
- Notification preferences (email / push / Google Calendar — can enable multiple)

---

## Core Concepts

### Project
A project represents one customer order end-to-end.

Fields:
- `id`
- `name` (e.g., "Lift Tower A - PT Maju Jaya")
- `customer_name`
- `customer_id` (foreign key)
- `created_at`
- `created_by` (user_id)
- `current_step` (integer, 1–22)
- `status` (`active` | `completed` | `on_hold`)

A customer can have multiple active projects.

### Step
Each project progresses through 22 fixed steps (see Step Definitions below).
Steps are sequential — step N must be completed before step N+1 is unlocked.

Step completion record:
- `project_id`
- `step_number`
- `completed_by` (user_id)
- `completed_at` (timestamp)
- `note` (text, optional)

### Reminder
Each step can have one or more auto-reminders that fire on a schedule until the step is marked done.

Reminder config (per step, configurable by admin):
- `trigger`: `on_step_unlock` | `days_after_unlock` | `days_before_deadline`
- `interval_days`: how often to repeat
- `max_repeats`: stop after N reminders (optional)

---

## Step Definitions

> All timing values are configurable by admin in Settings.
> Default values shown below.

### STAGE 1 – Pre-Order

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 1 | Sales request approval material ke customer | sales | Repeat tiap 3 hari sampai step done |
| 2 | AR tagih DP ke customer | ar | Repeat tiap 3 hari sampai step done |
| 3 | DP customer diterima | ar | One-time reminder H+1 setelah step 2 done |
| 4 | Purchasing buat PO ke pabrik | purchasing | Reminder di H atau H+1 setelah step 3 done |
| 5 | AP bayar DP ke pabrik | ap | Reminder segera setelah step 4 done |

### STAGE 2 – Production

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 6 | Folup pabrik — estimasi selesai | ap | Repeat tiap 3 hari |
| 7 | Folup pabrik + cek harga & booking kapal | ap | Reminder X hari sebelum estimasi selesai (default: 7 hari) |
| 8 | Cek customer ada space untuk terima barang | project | Reminder 7 hari sebelum estimasi barang jadi |

### STAGE 3 – Shipping Prep

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 9 | Booking kapal | shipping | Reminder segera setelah step 8 done |
| 10 | Minta dokumen ke pabrik (invoice, packing list, insurance, Form E, B/L) | shipping | Reminder segera setelah step 9 done |
| 11 | Siapkan dokumen bea cukai | shipping | Reminder segera setelah step 9 done |
| 12 | Cek harga truk, forklift, subcon | shipping | Reminder segera setelah step 9 done |

### STAGE 4 – In Transit

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 13 | Cek kapal sudah berangkat | shipping | Reminder tiap hari sampai done |
| 14 | Cek B/L sudah diterima | shipping | Reminder H+3 setelah step 13 done |

### STAGE 5 – Arrival & Installation

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 15 | Info ke finance: Material on Site | shipping | Reminder segera setelah barang tiba |
| 16 | Finance tagih customer sesuai payment term | finance | Reminder segera setelah step 15 done |
| 17 | Cek kondisi barang (ad-hoc: ada kerusakan/kekurangan?) | project | Reminder sekali setelah instalasi |

### STAGE 6 – Tescom & Garansi

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 18 | Buat & kirim sertifikat garansi ke customer | project | Reminder segera setelah tescom selesai |
| 19 | Konfirmasi BAST 2 (tanda tangan) | project | Reminder 1 bulan sebelum garansi habis |
| 20 | Tagih retensi ke customer | finance | Reminder 1 tahun setelah step 18 done |

### STAGE 7 – Post-Project / Maintenance

| # | Step Name | Responsible Division | Reminder Trigger |
|---|---|---|---|
| 21 | Tawarkan maintenance kontrak ke customer | sales_service | Reminder 1 bulan sebelum proyek selesai |
| 22 | Reminder perpanjangan maintenance kontrak | sales_service | Reminder 1 bulan sebelum kontrak habis |

---

## Pages & UI

### 1. Dashboard (/)
- List semua project aktif
- Tiap project card:
  - Nama project + customer
  - Progress bar: stage X / 7, step Y / 22
  - Status step sekarang: nama step + division yang bertanggung jawab
  - "Waiting since": berapa hari step ini belum diselesaikan → highlight merah kalau > threshold
  - Badge "HOGGER" kalau step stuck > X hari (configurable)
- Filter: by stage, by division, by status
- Sort: by most stuck, by newest, by stage

### 2. Project Detail (/projects/[id])
- Header: nama project, customer, tanggal mulai
- Timeline vertical semua 22 steps:
  - Step done: ✅ nama step | selesai oleh: [nama] | [timestamp] | [note kalau ada]
  - Step aktif: 🔵 nama step | PIC: [nama division] | reminder terakhir: [timestamp]
  - Step belum: ⬜ nama step | locked
- Tombol "Mark as Done" hanya muncul di step aktif, hanya untuk user dengan division yang sesuai
- Modal konfirmasi: "Tandai step ini selesai?" + text area untuk note (opsional)
- Setelah klik done → timestamp tersimpan → step berikutnya otomatis unlock → notif dikirim ke PIC berikutnya

### 3. Create Project (/projects/new)
- Form: nama project, pilih customer (atau tambah customer baru), tanggal mulai
- Submit → project dibuat di step 1, notif dikirim ke division Sales

### 4. My Tasks (/tasks)
- Khusus user login: list semua step aktif yang merupakan tanggung jawab divisi mereka
- Sort by: paling lama nunggu
- Quick action: langsung klik done dari sini

### 5. Settings — Admin Only (/settings)
- **Reminder Config**: per step, bisa ubah interval hari, max repeat, channel notif
- **Users**: tambah/edit/nonaktifkan user, assign division
- **Notification Channels**: toggle email / push / Google Calendar per user atau global default

### 6. Auth (/login)
- Supabase Auth — email + password
- Setelah login redirect ke Dashboard

---

## Notification System

### Channels
1. **Email** (via Resend) — kirim email ke PIC saat step unlock atau reminder
2. **Browser Push** (Web Push API) — notif di Windows/Android/iOS browser
3. **Google Calendar** — buat event di kalender user saat ada deadline / reminder

### Notification triggers
- Step baru unlock → kirim notif ke division yang bertanggung jawab
- Reminder repeat → kirim sesuai config (interval_days)
- Step stuck > threshold → kirim notif ke admin

### Cron Job (Supabase Edge Function, run daily)
```
For each active project:
  - Get current step
  - Check if reminder should fire today (based on config + last_reminded_at)
  - If yes → send notification to responsible division users
  - Update last_reminded_at
```

---

## Database Schema (Supabase / PostgreSQL)

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  division TEXT NOT NULL, -- sales | ar | purchasing | ap | shipping | project | finance | sales_service | admin
  email TEXT NOT NULL,
  notif_email BOOLEAN DEFAULT true,
  notif_push BOOLEAN DEFAULT true,
  notif_google_calendar BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active | completed | on_hold
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step Completions
CREATE TABLE step_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  step_number INTEGER NOT NULL,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ DEFAULT now(),
  note TEXT
);

-- Reminder Config (admin configurable per step)
CREATE TABLE reminder_config (
  step_number INTEGER PRIMARY KEY,
  trigger_type TEXT NOT NULL, -- on_unlock | interval | days_before_deadline
  interval_days INTEGER DEFAULT 3,
  max_repeats INTEGER, -- null = unlimited
  notify_channel TEXT DEFAULT 'all' -- all | email | push | calendar
);

-- Reminder Log
CREATE TABLE reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  step_number INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  channel TEXT NOT NULL
);

-- Ad-hoc Cases (step 17 — barang rusak/kurang)
CREATE TABLE adhoc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open | resolved
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  note TEXT
);
```

---

## Row Level Security (Supabase RLS)

- User hanya bisa lihat projects yang relevan dengan divisi mereka (atau semua kalau admin)
- User hanya bisa complete step yang merupakan tanggung jawab divisi mereka
- Admin bisa akses semua

---

## Key UX Notes

1. **Progress bar** di setiap project card — visual langsung keliatan udah sampai mana
2. **"Waiting since" counter** — hari ini step aktif belum diselesaikan, makin lama makin merah
3. **Hogger badge** — kalau step stuck > X hari (default 5), muncul badge merah di nama divisi
4. **Timestamp + note** — tiap klik done wajib tersimpan, note opsional
5. **My Tasks page** — user fokus ke tugas mereka sendiri, tidak perlu lihat semua project
6. **Mobile-friendly** — responsive, bisa dibuka dari HP

---

## Build Order (untuk Cursor)

Build in this order:

1. **Supabase setup** — create project, run schema SQL, enable auth
2. **Next.js project init** — `npx create-next-app`, install shadcn/ui + Tailwind
3. **Auth flow** — login page, session handling, redirect
4. **Database layer** — Supabase client, typed queries per table
5. **Dashboard page** — list projects + progress bar + hogger indicator
6. **Project Detail page** — timeline steps, mark as done modal
7. **Create Project page** — form
8. **My Tasks page**
9. **Notification system** — email (Resend) + push notif (service worker)
10. **Cron job** — Supabase Edge Function untuk daily reminder
11. **Settings page** — admin: users, reminder config
12. **Google Calendar integration** (last, setelah core selesai)
