
-- Buyer can create a vendor registration on behalf of a vendor.
-- Track which invitations were created in on-behalf mode so the seeding
-- function can auto-approve the BUYER stage (the buyer is the submitter).
ALTER TABLE public.vendor_invitations
  ADD COLUMN IF NOT EXISTS created_on_behalf boolean NOT NULL DEFAULT false;

-- Replace seeding function: when the source invitation has created_on_behalf=true,
-- the synthetic BUYER row is created with status='approved' (actor = buyer) and
-- the first pending stage falls through to SCM Manager (or next configured stage).
CREATE OR REPLACE FUNCTION public.seed_vendor_approval_progress(_vendor_id uuid)
 RETURNS TABLE(levels_created integer, vendor_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_invite_tenant uuid;
  v_msme boolean;
  v_buyer uuid;
  v_on_behalf boolean := false;
  v_skip_scm boolean := false;
  v_skip_buyer boolean := false;
  v_first_stage text;
  v_first_status text;
  v_count integer := 0;
  v_buyer_added boolean := false;
  v_buyer_auto_approved boolean := false;
BEGIN
  SELECT tenant_id,
         CASE WHEN COALESCE(vendor_type, 'domestic') = 'international'
              THEN false
              ELSE COALESCE(is_msme_registered, false)
         END
    INTO v_tenant, v_msme
  FROM public.vendors WHERE id = _vendor_id;

  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT 0, NULL::text;
    RETURN;
  END IF;

  SELECT vi.created_by, vi.tenant_id, COALESCE(vi.created_on_behalf, false)
    INTO v_buyer, v_invite_tenant, v_on_behalf
  FROM public.vendor_invitations vi
  WHERE vi.vendor_id = _vendor_id
  ORDER BY vi.created_at DESC
  LIMIT 1;

  IF v_invite_tenant IS NOT NULL AND v_invite_tenant <> v_tenant THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.approval_matrix_levels
      WHERE tenant_id = v_tenant AND is_active = true
    ) AND EXISTS (
      SELECT 1 FROM public.approval_matrix_levels
      WHERE tenant_id = v_invite_tenant AND is_active = true
    ) THEN
      v_tenant := v_invite_tenant;
      UPDATE public.vendors SET tenant_id = v_invite_tenant WHERE id = _vendor_id;
    END IF;
  END IF;

  IF v_buyer IS NOT NULL THEN
    SELECT bool_or(NOT include_scm_stages), bool_or(skip_buyer_stage)
      INTO v_skip_scm, v_skip_buyer
    FROM public.buyer_scm_mappings
    WHERE tenant_id = v_tenant AND buyer_user_id = v_buyer;
    v_skip_scm := COALESCE(v_skip_scm, false);
    v_skip_buyer := COALESCE(v_skip_buyer, false);
  END IF;

  DELETE FROM public.vendor_approval_progress WHERE vendor_id = _vendor_id;

  -- Insert synthetic Buyer row at level 1 if we have an inviting buyer and not skipped.
  -- For on-behalf submissions, immediately mark it approved (buyer is the submitter).
  IF v_buyer IS NOT NULL AND NOT v_skip_buyer THEN
    IF v_on_behalf THEN
      INSERT INTO public.vendor_approval_progress
        (vendor_id, level_id, level_number, status, stage, acted_by, acted_at, comments)
      VALUES
        (_vendor_id, NULL, 1, 'approved', 'BUYER', v_buyer, now(),
         'Auto-approved: application submitted by buyer on behalf of vendor');
      v_buyer_auto_approved := true;
    ELSE
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, 1, 'pending', 'BUYER');
    END IF;
    v_buyer_added := true;
    v_count := 1;
  END IF;

  -- Insert matrix rows starting at level 2 (or 1 if no buyer row).
  WITH eligible AS (
    SELECT l.id AS level_id, l.stage, l.level_number AS original_level_number
    FROM public.approval_matrix_levels l
    WHERE l.tenant_id = v_tenant
      AND l.is_active = true
      AND (l.requires_msme = false OR v_msme = true)
      AND (NOT v_skip_scm OR l.stage NOT IN ('SCM_MANAGER','SCM_HEAD'))
      AND l.stage <> 'BUYER'
      AND EXISTS (
        SELECT 1 FROM public.approval_matrix_approvers a WHERE a.level_id = l.id
      )
  ),
  ordered AS (
    SELECT
      level_id, stage,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE stage
            WHEN 'SCM_MANAGER' THEN 1
            WHEN 'SCM_HEAD'    THEN 2
            WHEN 'FINANCE_1'   THEN 3
            WHEN 'FINANCE_2'   THEN 4
            WHEN 'CEO_OFFICE'  THEN 5
            ELSE 99
          END,
          original_level_number
      ) AS new_level_number
    FROM eligible
  ),
  inserted AS (
    INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
    SELECT _vendor_id, o.level_id, o.new_level_number + CASE WHEN v_buyer_added THEN 1 ELSE 0 END, 'pending', o.stage
    FROM ordered o
    RETURNING level_number
  )
  SELECT v_count + COUNT(*) INTO v_count FROM inserted;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::text;
    RETURN;
  END IF;

  -- Determine first PENDING stage. Pending wins; otherwise lowest level row.
  SELECT COALESCE(p.stage, l.stage) INTO v_first_stage
  FROM public.vendor_approval_progress p
  LEFT JOIN public.approval_matrix_levels l ON l.id = p.level_id
  WHERE p.vendor_id = _vendor_id
    AND p.status = 'pending'
  ORDER BY p.level_number ASC
  LIMIT 1;

  IF v_first_stage IS NULL THEN
    SELECT COALESCE(p.stage, l.stage) INTO v_first_stage
    FROM public.vendor_approval_progress p
    LEFT JOIN public.approval_matrix_levels l ON l.id = p.level_id
    WHERE p.vendor_id = _vendor_id
    ORDER BY p.level_number ASC
    LIMIT 1;
  END IF;

  v_first_status := CASE v_first_stage
    WHEN 'BUYER'       THEN 'buyer_review'
    WHEN 'SCM_MANAGER' THEN 'scm_manager_review'
    WHEN 'SCM_HEAD'    THEN 'scm_head_review'
    WHEN 'FINANCE_1'   THEN 'finance_1_review'
    WHEN 'FINANCE_2'   THEN 'finance_2_review'
    WHEN 'CEO_OFFICE'  THEN 'ceo_office_review'
    ELSE 'scm_manager_review'
  END;

  UPDATE public.vendors SET status = v_first_status::vendor_status WHERE id = _vendor_id;

  RETURN QUERY SELECT v_count, v_first_status;
END;
$function$;
