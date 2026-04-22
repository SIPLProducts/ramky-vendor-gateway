DROP POLICY IF EXISTS "Vendors can submit feedback" ON public.vendor_feedback;

CREATE POLICY "Anyone can submit feedback"
ON public.vendor_feedback FOR INSERT TO public
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND user_id IS NULL)
);