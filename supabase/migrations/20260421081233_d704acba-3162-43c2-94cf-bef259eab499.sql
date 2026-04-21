-- Add tenant scoping to custom_roles (nullable = global/legacy)
ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_custom_roles_tenant ON public.custom_roles(tenant_id);

-- Update RLS to respect tenant scoping
DROP POLICY IF EXISTS "Admins manage custom roles" ON public.custom_roles;
DROP POLICY IF EXISTS "All authenticated can read custom roles" ON public.custom_roles;

CREATE POLICY "Sharvi/admin manage all custom roles"
ON public.custom_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'sharvi_admin') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'sharvi_admin') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customer admins manage own tenant custom roles"
ON public.custom_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'customer_admin') AND tenant_id IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id))
WITH CHECK (public.has_role(auth.uid(), 'customer_admin') AND tenant_id IS NOT NULL AND public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Authenticated read custom roles"
ON public.custom_roles FOR SELECT TO authenticated
USING (true);

-- Add tenant scoping to role_screen_permissions (nullable tenant_id = global default)
ALTER TABLE public.role_screen_permissions
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Drop old unique constraint (role, screen_key) and add (role, screen_key, tenant_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_screen_permissions_role_screen_key_key') THEN
    ALTER TABLE public.role_screen_permissions DROP CONSTRAINT role_screen_permissions_role_screen_key_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS role_screen_permissions_role_screen_tenant_uniq
  ON public.role_screen_permissions (role, screen_key, COALESCE(tenant_id::text, ''));