-- Recreate admin/sharvi_admin manage policies with explicit WITH CHECK so INSERT and UPDATE both pass
DROP POLICY IF EXISTS "Sharvi admins can manage all vendors" ON public.vendors;
DROP POLICY IF EXISTS "Admins can manage all vendors" ON public.vendors;

CREATE POLICY "Sharvi admins can manage all vendors"
ON public.vendors
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'sharvi_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'sharvi_admin'::public.app_role));

CREATE POLICY "Admins can manage all vendors"
ON public.vendors
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Also allow customer_admin to fully manage vendors within their tenants (currently only update)
DROP POLICY IF EXISTS "Customer admins manage tenant vendors" ON public.vendors;
CREATE POLICY "Customer admins manage tenant vendors"
ON public.vendors
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer_admin'::public.app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer_admin'::public.app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);