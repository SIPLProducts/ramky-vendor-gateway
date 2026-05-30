
DROP POLICY IF EXISTS "Vendors can insert own validations" ON public.vendor_validations;
CREATE POLICY "Vendors can insert own validations"
ON public.vendor_validations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_validations.vendor_id AND v.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Vendors can update own validations" ON public.vendor_validations;
CREATE POLICY "Vendors can update own validations"
ON public.vendor_validations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_validations.vendor_id AND v.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Vendors can delete own validations" ON public.vendor_validations;
CREATE POLICY "Vendors can delete own validations"
ON public.vendor_validations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_validations.vendor_id AND v.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Reviewers can insert validations for visible vendors" ON public.vendor_validations;
CREATE POLICY "Reviewers can insert validations for visible vendors"
ON public.vendor_validations FOR INSERT TO authenticated
WITH CHECK (
  public.is_cross_tenant_reviewer(auth.uid())
  OR (
    public.has_custom_role(auth.uid(), 'SCM Manager')
    AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
  )
  OR (
    (public.has_role(auth.uid(), 'finance'::app_role)
      OR public.has_role(auth.uid(), 'purchase'::app_role)
      OR public.has_role(auth.uid(), 'customer_admin'::app_role)
      OR public.has_role(auth.uid(), 'approver'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_validations.vendor_id
        AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
    )
  )
);
