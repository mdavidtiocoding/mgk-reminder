-- Seed role permission matrix in app_config (optional).
-- Defaults are also hard-coded in lib/auth/permissions.ts if this row is missing.
-- Run in Supabase SQL Editor after add-app-config.sql.

INSERT INTO public.app_config (key, value) VALUES (
  'role_permissions',
  '{
    "marketing":{"create_project":true,"edit_project":true,"change_project_status":false,"delete_project":false,"undo_step":false,"manage_adhoc":false,"settings_users":false,"settings_reminders":false,"settings_flow":false,"settings_demo":false,"settings_app_config":false,"settings_permissions":false},
    "ar":{"create_project":true,"edit_project":true,"change_project_status":false,"delete_project":false,"undo_step":false,"manage_adhoc":false,"settings_users":false,"settings_reminders":false,"settings_flow":false,"settings_demo":false,"settings_app_config":false,"settings_permissions":false},
    "logistik":{"create_project":true,"edit_project":true,"change_project_status":false,"delete_project":false,"undo_step":false,"manage_adhoc":false,"settings_users":false,"settings_reminders":false,"settings_flow":false,"settings_demo":false,"settings_app_config":false,"settings_permissions":false},
    "finance":{"create_project":true,"edit_project":true,"change_project_status":false,"delete_project":false,"undo_step":false,"manage_adhoc":false,"settings_users":false,"settings_reminders":false,"settings_flow":false,"settings_demo":false,"settings_app_config":false,"settings_permissions":false},
    "shipping":{"create_project":true,"edit_project":true,"change_project_status":false,"delete_project":false,"undo_step":false,"manage_adhoc":false,"settings_users":false,"settings_reminders":false,"settings_flow":false,"settings_demo":false,"settings_app_config":false,"settings_permissions":false},
    "project":{"create_project":true,"edit_project":true,"change_project_status":false,"delete_project":false,"undo_step":false,"manage_adhoc":true,"settings_users":false,"settings_reminders":false,"settings_flow":false,"settings_demo":false,"settings_app_config":false,"settings_permissions":false},
    "admin":{"create_project":true,"edit_project":true,"change_project_status":true,"delete_project":true,"undo_step":true,"manage_adhoc":true,"settings_users":true,"settings_reminders":true,"settings_flow":true,"settings_demo":true,"settings_app_config":true,"settings_permissions":true}
  }'
)
ON CONFLICT (key) DO NOTHING;
