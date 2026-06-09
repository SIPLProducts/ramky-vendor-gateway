
-- 1. Helper functions
CREATE OR REPLACE FUNCTION public.is_sap_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_custom_roles ucr
    JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
    WHERE ucr.user_id = _user_id
      AND cr.is_active = true
      AND lower(cr.name) = 'sap team'
  );
$$;

CREATE OR REPLACE FUNCTION public.buyer_visible_vendor_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT vi.vendor_id
  FROM public.vendor_invitations vi
  WHERE vi.created_by = _user_id
    AND vi.vendor_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.approver_visible_vendor_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT vi.vendor_id
  FROM public.buyer_approval_flows f
  JOIN public.vendor_invitations vi ON vi.created_by = f.buyer_user_id
  WHERE vi.vendor_id IS NOT NULL
    AND (
      f.scm_head_user_id   = _user_id
      OR f.finance_1_user_id = _user_id
      OR f.finance_2_user_id = _user_id
      OR f.ceo_office_user_id = _user_id
      OR f.scm_manager_user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_see_vendor(_user_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'sharvi_admin'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.is_sap_team(_user_id)
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = _vendor_id AND v.user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = _vendor_id
        AND v.tenant_id IN (SELECT public.user_tenant_ids(_user_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.vendor_invitations vi
      WHERE vi.vendor_id = _vendor_id AND vi.created_by = _user_id
    )
    OR public.scm_manager_can_see_vendor(_user_id, _vendor_id)
    OR EXISTS (
      SELECT 1
      FROM public.buyer_approval_flows f
      JOIN public.vendor_invitations vi ON vi.created_by = f.buyer_user_id
      WHERE vi.vendor_id = _vendor_id
        AND (
          f.scm_head_user_id   = _user_id
          OR f.finance_1_user_id = _user_id
          OR f.finance_2_user_id = _user_id
          OR f.ceo_office_user_id = _user_id
          OR f.scm_manager_user_id = _user_id
        )
    );
$$;

-- 2. Replace the broad cross-tenant SELECT policy on vendors
DROP POLICY IF EXISTS "Cross-tenant reviewers view all vendors" ON public.vendors;

CREATE POLICY "SAP team views all vendors"
ON public.vendors FOR SELECT
USING (public.is_sap_team(auth.uid()));

CREATE POLICY "Approvers view routed vendors"
ON public.vendors FOR SELECT
USING (
  id IN (SELECT public.approver_visible_vendor_ids(auth.uid()))
);

-- 3. Mirror on related tables (read access)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendor_documents','vendor_validations','vendor_approval_progress','audit_logs']
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Visible vendor scoped read" ON public.%I', t
    );
    EXECUTE format(
      'CREATE POLICY "Visible vendor scoped read" ON public.%I FOR SELECT USING (vendor_id IS NOT NULL AND public.user_can_see_vendor(auth.uid(), vendor_id))',
      t
    );
  END LOOP;
END$$;
