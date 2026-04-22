DROP POLICY IF EXISTS "Vendors can update own draft data" ON public.vendors;

CREATE POLICY "Vendors can update own draft data"
ON public.vendors
FOR UPDATE
TO public
USING (
  user_id = auth.uid()
  AND status = 'draft'::vendor_status
)
WITH CHECK (
  user_id = auth.uid()
  AND status = ANY (
    ARRAY[
      'draft'::vendor_status,
      'submitted'::vendor_status,
      'validation_pending'::vendor_status,
      'finance_review'::vendor_status
    ]
  )
);