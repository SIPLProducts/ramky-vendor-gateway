
-- Helpers ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_custom_role(_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
    WHERE ucr.user_id = _user_id
      AND cr.is_active = true
      AND lower(cr.name) = lower(_name)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_cross_tenant_reviewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
    WHERE ucr.user_id = _user_id
      AND cr.is_active = true
      AND lower(cr.name) IN (
        'scm head','finance 1','finance 2','finance approval','ceo office','sap team'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.scm_manager_can_see_vendor(_user_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_invitations vi
    JOIN public.buyer_scm_mappings m
      ON m.buyer_user_id = vi.created_by
    WHERE vi.vendor_id = _vendor_id
      AND m.scm_manager_user_id = _user_id
  );
$$;

-- Policies (additive) ---------------------------------------------------
-- vendors
DROP POLICY IF EXISTS "Cross-tenant reviewers view all vendors" ON public.vendors;
CREATE POLICY "Cross-tenant reviewers view all vendors"
ON public.vendors FOR SELECT TO authenticated
USING (public.is_cross_tenant_reviewer(auth.uid()));

DROP POLICY IF EXISTS "SCM Manager views mapped buyer vendors" ON public.vendors;
CREATE POLICY "SCM Manager views mapped buyer vendors"
ON public.vendors FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM Manager')
  AND public.scm_manager_can_see_vendor(auth.uid(), id)
);

-- vendor_validations
DROP POLICY IF EXISTS "Cross-tenant reviewers view all validations" ON public.vendor_validations;
CREATE POLICY "Cross-tenant reviewers view all validations"
ON public.vendor_validations FOR SELECT TO authenticated
USING (public.is_cross_tenant_reviewer(auth.uid()));

DROP POLICY IF EXISTS "SCM Manager views mapped validations" ON public.vendor_validations;
CREATE POLICY "SCM Manager views mapped validations"
ON public.vendor_validations FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM Manager')
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- vendor_documents
DROP POLICY IF EXISTS "Cross-tenant reviewers view all documents" ON public.vendor_documents;
CREATE POLICY "Cross-tenant reviewers view all documents"
ON public.vendor_documents FOR SELECT TO authenticated
USING (public.is_cross_tenant_reviewer(auth.uid()));

DROP POLICY IF EXISTS "SCM Manager views mapped documents" ON public.vendor_documents;
CREATE POLICY "SCM Manager views mapped documents"
ON public.vendor_documents FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM Manager')
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- vendor_approval_progress
DROP POLICY IF EXISTS "Cross-tenant reviewers view all progress" ON public.vendor_approval_progress;
CREATE POLICY "Cross-tenant reviewers view all progress"
ON public.vendor_approval_progress FOR SELECT TO authenticated
USING (public.is_cross_tenant_reviewer(auth.uid()));

DROP POLICY IF EXISTS "SCM Manager views mapped progress" ON public.vendor_approval_progress;
CREATE POLICY "SCM Manager views mapped progress"
ON public.vendor_approval_progress FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM Manager')
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- audit_logs
DROP POLICY IF EXISTS "Cross-tenant reviewers view all audit logs" ON public.audit_logs;
CREATE POLICY "Cross-tenant reviewers view all audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_cross_tenant_reviewer(auth.uid()));

DROP POLICY IF EXISTS "SCM Manager views mapped audit logs" ON public.audit_logs;
CREATE POLICY "SCM Manager views mapped audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM Manager')
  AND vendor_id IS NOT NULL
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);

-- ocr_extractions
DROP POLICY IF EXISTS "Cross-tenant reviewers view all ocr extractions" ON public.ocr_extractions;
CREATE POLICY "Cross-tenant reviewers view all ocr extractions"
ON public.ocr_extractions FOR SELECT TO authenticated
USING (public.is_cross_tenant_reviewer(auth.uid()));

DROP POLICY IF EXISTS "SCM Manager views mapped ocr extractions" ON public.ocr_extractions;
CREATE POLICY "SCM Manager views mapped ocr extractions"
ON public.ocr_extractions FOR SELECT TO authenticated
USING (
  public.has_custom_role(auth.uid(), 'SCM Manager')
  AND vendor_id IS NOT NULL
  AND public.scm_manager_can_see_vendor(auth.uid(), vendor_id)
);
