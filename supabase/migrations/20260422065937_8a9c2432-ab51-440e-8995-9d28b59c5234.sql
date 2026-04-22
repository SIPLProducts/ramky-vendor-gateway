DROP POLICY IF EXISTS "Vendors can update own draft data" ON public.vendors;

CREATE POLICY "Vendors can update own draft data"
ON public.vendors
FOR UPDATE
USING ((user_id = auth.uid()) AND (status = ANY (ARRAY['draft'::vendor_status, 'validation_failed'::vendor_status, 'finance_rejected'::vendor_status])))
WITH CHECK (
  (user_id = auth.uid())
  AND (status = ANY (ARRAY[
    'draft'::vendor_status,
    'submitted'::vendor_status,
    'validation_pending'::vendor_status,
    'finance_review'::vendor_status,
    'purchase_review'::vendor_status
  ]))
);