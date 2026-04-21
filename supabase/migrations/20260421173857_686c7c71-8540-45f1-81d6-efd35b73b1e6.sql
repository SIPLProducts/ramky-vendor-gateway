-- Allow any authenticated user who belongs to the target tenant to create/manage invitations for that tenant
CREATE POLICY "Tenant members can create invitations"
ON public.vendor_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IS NOT NULL
  AND user_belongs_to_tenant(auth.uid(), tenant_id)
);

CREATE POLICY "Tenant members can view tenant invitations"
ON public.vendor_invitations
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Tenant members can update tenant invitations"
ON public.vendor_invitations
FOR UPDATE
TO authenticated
USING (
  tenant_id IS NOT NULL
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
)
WITH CHECK (
  tenant_id IS NOT NULL
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);