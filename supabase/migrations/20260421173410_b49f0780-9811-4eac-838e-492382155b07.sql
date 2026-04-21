
-- 1. Backfill vendors.tenant_id with the only existing tenant
UPDATE public.vendors
SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL;

-- 2. Helper function: returns tenant ids the user belongs to (SECURITY DEFINER avoids recursion)
CREATE OR REPLACE FUNCTION public.user_tenant_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_tenants WHERE user_id = _user_id
$$;

-- =====================================================================
-- VENDORS: replace permissive policies with tenant-scoped ones
-- =====================================================================
DROP POLICY IF EXISTS "Finance can view all vendors" ON public.vendors;
DROP POLICY IF EXISTS "Finance can update vendors in review" ON public.vendors;
DROP POLICY IF EXISTS "Purchase can view all vendors" ON public.vendors;
DROP POLICY IF EXISTS "Purchase can update vendors in purchase review" ON public.vendors;

CREATE POLICY "Finance can view tenant vendors"
ON public.vendors FOR SELECT
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Finance can update tenant vendors in review"
ON public.vendors FOR UPDATE
USING (
  has_role(auth.uid(), 'finance'::app_role)
  AND status = ANY (ARRAY['finance_review'::vendor_status, 'validation_failed'::vendor_status])
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Purchase can view tenant vendors"
ON public.vendors FOR SELECT
USING (
  has_role(auth.uid(), 'purchase'::app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Purchase can update tenant vendors in purchase review"
ON public.vendors FOR UPDATE
USING (
  has_role(auth.uid(), 'purchase'::app_role)
  AND status = 'purchase_review'::vendor_status
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Customer admins view tenant vendors"
ON public.vendors FOR SELECT
USING (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Customer admins update tenant vendors"
ON public.vendors FOR UPDATE
USING (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

CREATE POLICY "Approvers view tenant vendors"
ON public.vendors FOR SELECT
USING (
  has_role(auth.uid(), 'approver'::app_role)
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

-- =====================================================================
-- VENDOR_INVITATIONS: scope finance/purchase/customer_admin by tenant
-- =====================================================================
DROP POLICY IF EXISTS "Finance and Purchase can view invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Admins can view all invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.vendor_invitations;

CREATE POLICY "Super admins manage all invitations"
ON public.vendor_invitations FOR ALL
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customer admins manage tenant invitations"
ON public.vendor_invitations FOR ALL
USING (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND (tenant_id IS NULL OR tenant_id IN (SELECT public.user_tenant_ids(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND (tenant_id IS NULL OR tenant_id IN (SELECT public.user_tenant_ids(auth.uid())))
);

CREATE POLICY "Finance and purchase view tenant invitations"
ON public.vendor_invitations FOR SELECT
USING (
  (has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'purchase'::app_role))
  AND tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
);

-- =====================================================================
-- VENDOR_DOCUMENTS: scope via parent vendor's tenant
-- =====================================================================
DROP POLICY IF EXISTS "Admins can view all documents" ON public.vendor_documents;
DROP POLICY IF EXISTS "Finance and Purchase can view all documents" ON public.vendor_documents;
DROP POLICY IF EXISTS "Sharvi admins can view all documents" ON public.vendor_documents;

CREATE POLICY "Super admins view all documents"
ON public.vendor_documents FOR SELECT
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Portal users view tenant documents"
ON public.vendor_documents FOR SELECT
USING (
  (has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'purchase'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
    OR has_role(auth.uid(), 'approver'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_documents.vendor_id
      AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);

-- =====================================================================
-- VENDOR_VALIDATIONS: scope via parent vendor's tenant
-- =====================================================================
DROP POLICY IF EXISTS "Finance and Purchase can view all validations" ON public.vendor_validations;
DROP POLICY IF EXISTS "Sharvi admins can view all validations" ON public.vendor_validations;

CREATE POLICY "Super admins view all validations"
ON public.vendor_validations FOR SELECT
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Portal users view tenant validations"
ON public.vendor_validations FOR SELECT
USING (
  (has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'purchase'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
    OR has_role(auth.uid(), 'approver'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = vendor_validations.vendor_id
      AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);

-- =====================================================================
-- VALIDATION_API_LOGS: scope via parent vendor's tenant
-- =====================================================================
DROP POLICY IF EXISTS "Finance and Purchase can view validation logs" ON public.validation_api_logs;
DROP POLICY IF EXISTS "Admins can view all API logs" ON public.validation_api_logs;
DROP POLICY IF EXISTS "Sharvi admins can view all validation logs" ON public.validation_api_logs;

CREATE POLICY "Super admins view all API logs"
ON public.validation_api_logs FOR SELECT
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Portal users view tenant API logs"
ON public.validation_api_logs FOR SELECT
USING (
  (has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'purchase'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
    OR has_role(auth.uid(), 'approver'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = validation_api_logs.vendor_id
      AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);

-- =====================================================================
-- OCR_EXTRACTIONS: scope via parent vendor's tenant
-- =====================================================================
DROP POLICY IF EXISTS "Admins view all ocr extractions" ON public.ocr_extractions;

CREATE POLICY "Super admins view all ocr extractions"
ON public.ocr_extractions FOR SELECT
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Portal users view tenant ocr extractions"
ON public.ocr_extractions FOR SELECT
USING (
  (has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'purchase'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
    OR has_role(auth.uid(), 'approver'::app_role))
  AND vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = ocr_extractions.vendor_id
      AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);

-- =====================================================================
-- AUDIT_LOGS: scope finance/purchase via vendor's tenant
-- =====================================================================
DROP POLICY IF EXISTS "Finance and Purchase can view all audit logs" ON public.audit_logs;

CREATE POLICY "Finance and purchase view tenant audit logs"
ON public.audit_logs FOR SELECT
USING (
  (has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'purchase'::app_role))
  AND vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = audit_logs.vendor_id
      AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);

CREATE POLICY "Customer admins view tenant audit logs"
ON public.audit_logs FOR SELECT
USING (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND vendor_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = audit_logs.vendor_id
      AND v.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);

-- =====================================================================
-- PROFILES: customer_admin sees profiles of users sharing a tenant
-- =====================================================================
CREATE POLICY "Customer admins view tenant profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'customer_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_tenants ut
    WHERE ut.user_id = profiles.id
      AND ut.tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
  )
);
