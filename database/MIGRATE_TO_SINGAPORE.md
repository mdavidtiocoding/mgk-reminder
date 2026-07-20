# Migrate Supabase Korea → Singapore

Supabase **tidak bisa ganti region** project yang sudah ada. Buat project baru di Singapore, pindahkan data, update env di Vercel.

**Target region:** Southeast Asia (Singapore) — `ap-southeast-1`  
**Tidak ada region Indonesia** di Supabase; Singapore terdekat.

---

## Checklist singkat

- [ ] 1. Backup project Korea (CLI dump)
- [ ] 2. Buat project baru → **Singapore**
- [ ] 3. Restore dump ke project baru
- [ ] 4. Copy Auth settings (Site URL, Google OAuth, dll.)
- [ ] 5. Update env Vercel + `.env.local`
- [ ] 6. Set Vercel function region → `sin1` (sudah di `vercel.json`)
- [ ] 7. Deploy + smoke test
- [ ] 8. Pause/delete project Korea (setelah yakin OK)

---

## Persiapan (Windows)

Install sekali:

1. **Supabase CLI** — `npm install -g supabase`
2. **Docker Desktop** — dibutuhkan CLI untuk `supabase db dump`
3. **PostgreSQL client (`psql`)** — [PostgreSQL installer](https://www.postgresql.org/download/windows/), tambahkan `C:\Program Files\PostgreSQL\17\bin` ke PATH

Verifikasi:

```powershell
supabase --version
docker --version
psql --version
```

Login Supabase:

```powershell
supabase login
```

---

## Step 1 — Backup project Korea (OLD)

1. Supabase Dashboard → project **Korea** → **Connect**
2. Copy **Session pooler** connection string (port 5432)
3. **Database → Settings** → reset/copy database password → ganti `[YOUR-PASSWORD]` di connection string

Buat folder backup:

```powershell
cd c:\2-NextJS\mgk-reminder
mkdir supabase-migration-backup
cd supabase-migration-backup
```

Dump (ganti connection string):

```powershell
$OLD = "postgresql://postgres.[OLD-REF]:[PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"

supabase db dump --db-url $OLD -f roles.sql --role-only
supabase db dump --db-url $OLD -f schema.sql
supabase db dump --db-url $OLD -f data.sql --use-copy --data-only
```

> Host pooler Korea biasanya `ap-northeast-2`. Cek di dashboard Connect panel — ikuti string yang muncul di sana.

Simpan juga manual dari dashboard (screenshot / copy):

- **Authentication → URL Configuration** (Site URL, Redirect URLs)
- **Authentication → Providers** (Google client id/secret jika dipakai)
- **Project Settings → API** (anon key & service role — akan dapat yang baru)

---

## Step 2 — Buat project Singapore (NEW)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. **Region: Southeast Asia (Singapore)**
3. Set database password → **simpan**
4. Tunggu project ready (~2 menit)

Di project baru, enable extension yang sama dengan project lama (biasanya sudah default):

- Dashboard → **Database → Extensions** — cek `pgcrypto`, `uuid-ossp` jika dipakai

Jalankan **hanya jika restore dump gagal** (fresh schema fallback):

```sql
-- SQL Editor project BARU — hanya kalau tidak pakai restore penuh
-- 1) database/schema.sql
-- 2) database/push_subscriptions.sql
-- 3) database/fix-push-subscriptions-rls.sql (jika ada)
```

---

## Step 3 — Restore ke project Singapore

1. Project **Singapore** → **Connect** → copy connection string
2. Restore:

```powershell
$NEW = "postgresql://postgres.[NEW-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

psql --single-transaction --variable ON_ERROR_STOP=1 `
  --file roles.sql `
  --file schema.sql `
  --command "SET session_replication_role = replica" `
  --file data.sql `
  --dbname $NEW
```

> Urutan penting: `roles` → `schema` → `data`.  
> `session_replication_role = replica` melewati trigger/FK sementara saat import.

### Verifikasi setelah restore

Jalankan di SQL Editor project **Singapore**:

```sql
-- database/verify-schema.sql
```

Bandingkan row counts dengan project Korea. Khususnya:

- `profiles` = jumlah user
- `projects`, `step_completions` = data operasional
- `step_definitions` = 32 baris

Test login user lama — password auth ikut ter-migrate kalau `auth.users` ikut di dump.

---

## Step 4 — Auth & integrasi

Di project **Singapore** → **Authentication**:

| Setting | Value |
|---------|-------|
| Site URL | `https://mgk-reminder.vercel.app` |
| Redirect URLs | `https://mgk-reminder.vercel.app/auth/callback` |

Copy ulang dari project Korea jika ada URL tambahan (localhost dev, dll.).

**Google Calendar OAuth** — copy `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` yang sama di Vercel (tidak perlu ganti kecuali redirect URI berubah).

---

## Step 5 — Update environment variables

### Vercel → mgk-reminder → Settings → Environment Variables

Update dari project **Singapore** → **Settings → API**:

| Variable | Dari |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[NEW-REF].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key (baru) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (baru) |

Jangan ubah: `CRON_SECRET`, `RESEND_*`, `VAPID_*`, `GOOGLE_*`, `NEXT_PUBLIC_APP_URL`.

### Local `.env.local`

Update 3 key Supabase yang sama → test local:

```powershell
npm run dev
```

---

## Step 6 — Deploy Vercel (region Singapore)

`vercel.json` sudah set `"regions": ["sin1"]`.

```powershell
cd c:\2-NextJS\mgk-reminder
npx vercel --prod
```

---

## Step 7 — Smoke test

- [ ] Login user lama
- [ ] Dashboard load cepat (< 2 detik)
- [ ] Buka project detail
- [ ] My Tasks
- [ ] Settings → Flow config (edit prerequisites)
- [ ] Mark step done (jika ada project aktif)
- [ ] Push notification / Google Calendar (jika dipakai)

---

## Step 8 — Matikan project Korea

Setelah 1–2 hari stabil:

- Pause atau delete project Korea di Supabase Dashboard
- **Jangan delete** sebelum yakin auth + data + cron jalan di Singapore

---

## Alternatif: data sedikit, user sedikit

Kalau dump/restore ribet dan user < 5:

1. Project baru Singapore → jalankan `schema.sql` + `push_subscriptions.sql`
2. User **register ulang** (admin approve di `/settings/users`)
3. Export manual dari Korea SQL Editor → import CSV/SQL untuk `customers`, `projects`, `step_completions` saja
4. Copy custom `step_definitions.name` / `prerequisites` jika sudah diedit di Flow Config

---

## Referensi

- [Change project region](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z)
- [Backup & restore CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
