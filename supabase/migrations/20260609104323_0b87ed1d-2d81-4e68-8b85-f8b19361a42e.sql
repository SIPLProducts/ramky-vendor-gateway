
-- 1. Tighten user_can_see_vendor: remove broad tenant-membership branch.
CREATE OR REPLACE FUNCTION public.user_can_see_vendor(_user_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'sharvi_admin'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.is_sap_team(_user_id)
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = _vendor_id AND v.user_id = _user_id)
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

-- 2. Drop broad-tenant policies on vendors.
DROP POLICY IF EXISTS "Approvers view tenant vendors" ON public.vendors;
DROP POLICY IF EXISTS "Purchase can view tenant vendors" ON public.vendors;
DROP POLICY IF EXISTS "Finance can view tenant vendors" ON public.vendors;
DROP POLICY IF EXISTS "Customer admins view tenant vendors" ON public.vendors;
DROP POLICY IF EXISTS "Customer admins update tenant vendors" ON public.vendors;
DROP POLICY IF EXISTS "Customer admins manage tenant vendors" ON public.vendors;
DROP POLICY IF EXISTS "Purchase can update tenant vendors in purchase review" ON public.vendors;
DROP POLICY IF EXISTS "Finance can update tenant vendors in review" ON public.vendors;

-- 3. Scoped write policies replacing the removed ones.
CREATE POLICY "Purchase can update their invited vendors in purchase review"
  ON public.vendors FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'purchase'::app_role)
    AND status = 'purchase_review'::vendor_status
    AND id IN (SELECT public.buyer_visible_vendor_ids(auth.uid()))
  );

CREATE POLICY "Finance can update routed vendors in review"
  ON public.vendors FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'finance'::app_role)
    AND status = ANY (ARRAY['finance_review'::vendor_status, 'validation_failed'::vendor_status])
    AND id IN (SELECT public.approver_visible_vendor_ids(auth.uid()))
  );

-- 4. Tighten vendor_invitations.
DROP POLICY IF EXISTS "Tenant members can view tenant invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Tenant members can update tenant invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Finance and purchase view tenant invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Customer admins manage tenant invitations" ON public.vendor_invitations;

CREATE POLICY "Buyers view own invitations"
  ON public.vendor_invitations FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Buyers update own invitations"
  ON public.vendor_invitations FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Stage approvers view routed invitations"
  ON public.vendor_invitations FOR SELECT
  USING (
    created_by IN (
      SELECT f.buyer_user_id FROM public.buyer_approval_flows f
      WHERE f.scm_manager_user_id = auth.uid()
         OR f.scm_head_user_id    = auth.uid()
         OR f.finance_1_user_id   = auth.uid()
         OR f.finance_2_user_id   = auth.uid()
         OR f.ceo_office_user_id  = auth.uid()
    )
  );

CREATE POLICY "SCM Managers view mapped buyer invitations"
  ON public.vendor_invitations FOR SELECT
  USING (
    created_by IN (
      SELECT m.buyer_user_id FROM public.buyer_scm_mappings m
      WHERE m.scm_manager_user_id = auth.uid()
    )
  );

CREATE POLICY "SAP Team view all invitations"
  ON public.vendor_invitations FOR SELECT
  USING (public.is_sap_team(auth.uid()));

CREATE POLICY "Customer admins manage all invitations"
  ON public.vendor_invitations FOR ALL
  USING (public.has_role(auth.uid(), 'customer_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'customer_admin'::app_role));
