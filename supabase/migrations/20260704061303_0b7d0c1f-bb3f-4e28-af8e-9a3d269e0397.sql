
-- Recreate vendor-documents storage policies to also allow the buyer who created the invitation
DROP POLICY IF EXISTS "Vendor owners can upload their documents" ON storage.objects;
DROP POLICY IF EXISTS "Vendor and approvers can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Vendor owners can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Vendor owners can delete their documents" ON storage.objects;

CREATE POLICY "Vendor owners can upload their documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE (v.id)::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_invitations vi
      WHERE vi.created_by = auth.uid()
        AND (
          (vi.vendor_id)::text = (storage.foldername(name))[1]
          OR EXISTS (
            SELECT 1 FROM public.vendors v2
            WHERE (v2.id)::text = (storage.foldername(name))[1]
              AND v2.invitation_id = vi.id
          )
        )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'customer_admin'::app_role)
  )
);

CREATE POLICY "Vendor and approvers can view documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vendor-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE (v.id)::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_invitations vi
      WHERE vi.created_by = auth.uid()
        AND (
          (vi.vendor_id)::text = (storage.foldername(name))[1]
          OR EXISTS (
            SELECT 1 FROM public.vendors v2
            WHERE (v2.id)::text = (storage.foldername(name))[1]
              AND v2.invitation_id = vi.id
          )
        )
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

CREATE POLICY "Vendor owners can update their documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vendor-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE (v.id)::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_invitations vi
      WHERE vi.created_by = auth.uid()
        AND (
          (vi.vendor_id)::text = (storage.foldername(name))[1]
          OR EXISTS (
            SELECT 1 FROM public.vendors v2
            WHERE (v2.id)::text = (storage.foldername(name))[1]
              AND v2.invitation_id = vi.id
          )
        )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'customer_admin'::app_role)
  )
);

CREATE POLICY "Vendor owners can delete their documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vendor-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE (v.id)::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_invitations vi
      WHERE vi.created_by = auth.uid()
        AND (
          (vi.vendor_id)::text = (storage.foldername(name))[1]
          OR EXISTS (
            SELECT 1 FROM public.vendors v2
            WHERE (v2.id)::text = (storage.foldername(name))[1]
              AND v2.invitation_id = vi.id
          )
        )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'customer_admin'::app_role)
  )
);
