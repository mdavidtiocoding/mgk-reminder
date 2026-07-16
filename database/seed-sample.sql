-- Sample data untuk test dashboard
-- Jalankan SELURUH script ini di Supabase SQL Editor (Run sekali)

DO $$
DECLARE
  v_customer_id UUID;
  v_user_id UUID;
BEGIN
  -- Backfill profile jika user Auth sudah ada tapi belum punya row di profiles
  INSERT INTO public.profiles (id, name, email, division)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
    u.email,
    COALESCE(u.raw_user_meta_data->>'division', 'marketing')
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

  -- Ambil atau buat customer
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE name = 'PT Maju Jaya'
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name)
    VALUES ('PT Maju Jaya')
    RETURNING id INTO v_customer_id;
  END IF;

  -- Ambil user pertama
  SELECT id INTO v_user_id
  FROM public.profiles
  ORDER BY created_at
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Belum ada user. Buat dulu di Authentication → Users, lalu jalankan ulang script ini.';
  END IF;

  -- Buat project jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE name = 'Lift Tower A - PT Maju Jaya'
  ) THEN
    INSERT INTO public.projects (name, customer_id, status, created_by)
    VALUES ('Lift Tower A - PT Maju Jaya', v_customer_id, 'active', v_user_id);
  END IF;

  RAISE NOTICE 'Seed berhasil!';
  RAISE NOTICE 'customer_id: %', v_customer_id;
  RAISE NOTICE 'created_by:  %', v_user_id;
END $$;

-- Verifikasi hasil
SELECT
  p.id,
  p.name,
  p.status,
  c.name AS customer,
  pr.name AS created_by_name,
  pr.division
FROM public.projects p
LEFT JOIN public.customers c ON c.id = p.customer_id
LEFT JOIN public.profiles pr ON pr.id = p.created_by
WHERE p.name = 'Lift Tower A - PT Maju Jaya';
