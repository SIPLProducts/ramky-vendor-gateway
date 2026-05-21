CREATE OR REPLACE FUNCTION public.seed_vendor_approval_progress(_vendor_id uuid)
 RETURNS TABLE(levels_created integer, vendor_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_msme boolean;
  v_buyer uuid;
  v_skip_scm boolean := false;
  v_first_stage text;
  v_first_status text;
  v_count integer := 0;
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

  SELECT vi.created_by INTO v_buyer
  FROM public.vendor_invitations vi
  WHERE vi.vendor_id = _vendor_id
  ORDER BY vi.created_at DESC
  LIMIT 1;

  IF v_buyer IS NOT NULL THEN
    SELECT bool_or(NOT include_scm_stages) INTO v_skip_scm
    FROM public.buyer_scm_mappings
    WHERE tenant_id = v_tenant AND buyer_user_id = v_buyer;
    v_skip_scm := COALESCE(v_skip_scm, false);
  END IF;

  DELETE FROM public.vendor_approval_progress WHERE vendor_id = _vendor_id;

  WITH eligible AS (
    SELECT l.id AS level_id, l.stage, l.level_number AS original_level_number
    FROM public.approval_matrix_levels l
    WHERE l.tenant_id = v_tenant
      AND l.is_active = true
      AND (l.requires_msme = false OR v_msme = true)
      AND (NOT v_skip_scm OR l.stage NOT IN ('SCM_MANAGER','SCM_HEAD'))
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
    INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status)
    SELECT _vendor_id, o.level_id, o.new_level_number, 'pending'
    FROM ordered o
    RETURNING level_number
  )
  SELECT COUNT(*) INTO v_count FROM inserted;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::text;
    RETURN;
  END IF;

  SELECT l.stage INTO v_first_stage
  FROM public.vendor_approval_progress p
  JOIN public.approval_matrix_levels l ON l.id = p.level_id
  WHERE p.vendor_id = _vendor_id
  ORDER BY p.level_number ASC
  LIMIT 1;

  v_first_status := CASE v_first_stage
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