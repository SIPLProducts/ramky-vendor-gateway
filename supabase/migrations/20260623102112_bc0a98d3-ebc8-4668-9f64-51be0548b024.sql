DROP POLICY IF EXISTS "Vendor and approvers can view documents" ON storage.objects;

CREATE POLICY "Vendor and approvers can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id::text = (storage.foldername(name))[1]
          AND (v.user_id = auth.uid()
               OR lower(v.primary_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
      OR public.has_role(auth.uid(), 'customer_admin'::app_role)
      OR public.has_role(auth.uid(), 'finance'::app_role)
      OR public.has_role(auth.uid(), 'purchase'::app_role)
      OR public.has_role(auth.uid(), 'approver'::app_role)
      OR public.is_sap_team(auth.uid())
      OR public.is_cross_tenant_reviewer(auth.uid())
    )
  );