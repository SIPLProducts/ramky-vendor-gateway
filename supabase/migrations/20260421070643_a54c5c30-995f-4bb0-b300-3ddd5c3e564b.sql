CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

DROP POLICY IF EXISTS "Customer admins can manage own tenant users" ON public.user_tenants;

CREATE POLICY "Customer admins can manage own tenant users"
ON public.user_tenants
FOR ALL
USING (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
)
WITH CHECK (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
);

-- Also allow admin/sharvi_admin general read so user management page works
DROP POLICY IF EXISTS "Admins can read all user tenants" ON public.user_tenants;
CREATE POLICY "Admins can read all user tenants"
ON public.user_tenants
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sharvi_admin'::app_role)
);