-- Run in Supabase SQL Editor to confirm schema is applied.
-- All expected tables should show status = OK.

WITH expected AS (
  SELECT unnest(ARRAY[
    'profiles',
    'customers',
    'step_definitions',
    'projects',
    'step_completions',
    'reminder_config',
    'reminder_log',
    'adhoc_cases',
    'push_subscriptions',
    'followup_schedule',
    'app_config'
  ]) AS table_name
),
found AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
)
SELECT
  e.table_name,
  CASE WHEN f.table_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM expected e
LEFT JOIN found f ON f.table_name = e.table_name
ORDER BY e.table_name;

-- Row counts (sanity check)
SELECT 'profiles' AS table_name, count(*) AS rows FROM public.profiles
UNION ALL SELECT 'customers', count(*) FROM public.customers
UNION ALL SELECT 'step_definitions', count(*) FROM public.step_definitions
UNION ALL SELECT 'projects', count(*) FROM public.projects
UNION ALL SELECT 'step_completions', count(*) FROM public.step_completions
UNION ALL SELECT 'reminder_config', count(*) FROM public.reminder_config
UNION ALL SELECT 'reminder_log', count(*) FROM public.reminder_log
UNION ALL SELECT 'adhoc_cases', count(*) FROM public.adhoc_cases
UNION ALL SELECT 'push_subscriptions', count(*) FROM public.push_subscriptions
UNION ALL SELECT 'followup_schedule', count(*) FROM public.followup_schedule
UNION ALL SELECT 'app_config', count(*) FROM public.app_config
ORDER BY table_name;

-- step_definitions / reminder_config should have 32 rows (one per workflow step)
SELECT count(*) AS step_definitions_rows,
       CASE WHEN count(*) = 32 THEN 'OK' ELSE 'CHECK SEED' END AS seed_status
FROM public.step_definitions;

SELECT count(*) AS reminder_config_rows,
       CASE WHEN count(*) = 32 THEN 'OK' ELSE 'CHECK SEED' END AS seed_status
FROM public.reminder_config;
