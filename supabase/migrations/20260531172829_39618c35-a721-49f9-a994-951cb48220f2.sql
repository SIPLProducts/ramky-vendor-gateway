CREATE POLICY "Inviting users view their vendors"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_invitations vi
    WHERE vi.vendor_id = vendors.id
      AND vi.created_by = auth.uid()
  )
);