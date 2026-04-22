-- Drop and recreate the vendor self-update policy so vendors can transition draft -> submitted
DROP POLICY IF EXISTS "Vendors can update own draft data" ON public.vendors;

CREATE POLICY "Vendors can update own draft data"
ON public.vendors
FOR UPDATE
USING (user_id = auth.uid() AND status = 'draft'::vendor_status)
WITH CHECK (user_id = auth.uid() AND status IN ('draft'::vendor_status, 'submitted'::vendor_status, 'validation_pending'::vendor_status));