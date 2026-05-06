
DROP POLICY IF EXISTS "Vendors can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete own documents" ON storage.objects;
DROP POLICY IF EXISTS "Finance and Purchase can view all vendor documents" ON storage.objects;

CREATE POLICY "Vendor owners can upload their documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE POLICY "Vendor owners can update their documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vendor-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE POLICY "Vendor owners can delete their documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id::text = (storage.foldername(name))[1]
        AND (
          v.user_id = auth.uid()
          OR lower(v.primary_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

CREATE POLICY "Vendor and approvers can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id::text = (storage.foldername(name))[1]
          AND (
            v.user_id = auth.uid()
            OR lower(v.primary_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
      OR public.has_role(auth.uid(), 'customer_admin'::app_role)
      OR public.has_role(auth.uid(), 'finance'::app_role)
      OR public.has_role(auth.uid(), 'purchase'::app_role)
      OR public.has_role(auth.uid(), 'approver'::app_role)
    )
  );
