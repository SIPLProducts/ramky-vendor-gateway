-- Rename the custom role stored in the custom_roles table
UPDATE public.custom_roles
SET name = 'SCM CO', updated_at = now()
WHERE name = 'SCM Manager';

-- Recreate access rules that reference the old role name so they match the new name

-- vendors
DROP POLICY IF EXISTS "SCM Manager views mapped buyer vendors" ON public.vendors;
CREATE POLICY "SCM CO views mapped buyer vendors"
ON public.vendors FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM CO')
  AND public.scm_manager_can_see_vendor(auth.uid(), id)
);

-- vendor_validations
DROP POLICY IF EXISTS "SCM Manager views mapped validations" ON public.vendor_validations;
CREATE POLICY "SCM CO views mapped validations"
ON public.vendor_validations FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM CO')
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

DROP POLICY IF EXISTS "Reviewers can insert validations for visible vendors" ON public.vendor_validations;
CREATE POLICY "Reviewers can insert validations for visible vendors"
ON public.vendor_validations FOR INSERT TO authenticated
WITH CHECK (
  public.is_cross_tenant_reviewer(auth.uid())
  OR (
    public.has_custom_role(auth.uid(), 'SCM CO')
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

-- vendor_documents
DROP POLICY IF EXISTS "SCM Manager views mapped documents" ON public.vendor_documents;
CREATE POLICY "SCM CO views mapped documents"
ON public.vendor_documents FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM CO')
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- vendor_approval_progress
DROP POLICY IF EXISTS "SCM Manager views mapped progress" ON public.vendor_approval_progress;
CREATE POLICY "SCM CO views mapped progress"
ON public.vendor_approval_progress FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM CO')
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- audit_logs
DROP POLICY IF EXISTS "SCM Manager views mapped audit logs" ON public.audit_logs;
CREATE POLICY "SCM CO views mapped audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM CO')
  AND vendor_id IS NOT NULL
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- ocr_extractions
DROP POLICY IF EXISTS "SCM Manager views mapped ocr extractions" ON public.ocr_extractions;
CREATE POLICY "SCM CO views mapped ocr extractions"
ON public.ocr_extractions FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM CO')
  AND vendor_id IS NOT NULL
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- vendor_invitations: rename the policy for consistency (it does not check the role name directly)
DROP POLICY IF EXISTS "SCM Managers view mapped buyer invitations" ON public.vendor_invitations;
CREATE POLICY "SCM CO view mapped buyer invitations"
ON public.vendor_invitations FOR SELECT TO authenticated
USING (
  created_by IN (
    SELECT m.buyer_user_id FROM public.buyer_scm_mappings m
    WHERE m.scm_manager_user_id = auth.uid()
  )
);