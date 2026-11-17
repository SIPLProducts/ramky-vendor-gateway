INSERT INTO public.role_screen_permissions (role, screen_key, can_access, tenant_id)
SELECT r::public.app_role, 'user_audit_report', true, NULL
FROM unnest(ARRAY['admin','sharvi_admin','customer_admin']) r
WHERE NOT EXISTS (SELECT 1 FROM public.role_screen_permissions p WHERE p.role = r::public.app_role AND p.screen_key='user_audit_report' AND p.tenant_id IS NULL);