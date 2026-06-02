
-- 1) Add 'buyer_review' to vendor_status enum
ALTER TYPE public.vendor_status ADD VALUE IF NOT EXISTS 'buyer_review';

-- 2) Allow 'BUYER' stage value on approval_matrix_levels (synthetic; not used in matrix rows)
ALTER TABLE public.approval_matrix_levels
  DROP CONSTRAINT IF EXISTS approval_matrix_levels_stage_check;
ALTER TABLE public.approval_matrix_levels
  ADD CONSTRAINT approval_matrix_levels_stage_check
  CHECK (stage IN ('BUYER','SCM_MANAGER','SCM_HEAD','FINANCE_1','FINANCE_2','CEO_OFFICE'));

-- 3) Synthetic buyer rows in vendor_approval_progress: level_id may be null, carry stage
ALTER TABLE public.vendor_approval_progress
  ALTER COLUMN level_id DROP NOT NULL;
ALTER TABLE public.vendor_approval_progress
  ADD COLUMN IF NOT EXISTS stage text;

-- 4) Per-buyer skip flag
ALTER TABLE public.buyer_scm_mappings
  ADD COLUMN IF NOT EXISTS skip_buyer_stage boolean NOT NULL DEFAULT false;

-- 5) Update trigger to include 'buyer_review' as a seedable status
CREATE OR REPLACE FUNCTION public.trg_vendors_seed_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists integer;
BEGIN
  IF NEW.status::text NOT IN (
    'buyer_review','scm_manager_review','scm_head_review','finance_1_review','finance_2_review','ceo_office_review'
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status::text = NEW.status::text THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status::text = 'returned_to_vendor' THEN
    PERFORM public.seed_vendor_approval_progress(NEW.id);
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_exists FROM public.vendor_approval_progress WHERE vendor_id = NEW.id;
  IF v_exists > 0 THEN
    RETURN NEW;
  END IF;

  PERFORM public.seed_vendor_approval_progress(NEW.id);
  RETURN NEW;
END;
$function$;

-- 6) Rewrite seed function to insert a synthetic Buyer Approval row at level 1
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
  v_skip_scm boolean := false;
  v_skip_buyer boolean := false;
  v_first_stage text;
  v_first_status text;
  v_count integer := 0;
  v_buyer_added boolean := false;
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

  SELECT vi.created_by, vi.tenant_id
    INTO v_buyer, v_invite_tenant
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
  IF v_buyer IS NOT NULL AND NOT v_skip_buyer THEN
    INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
    VALUES (_vendor_id, NULL, 1, 'pending', 'BUYER');
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

  -- Determine first stage from the lowest level row (prefer p.stage, fallback to joined level).
  SELECT COALESCE(p.stage, l.stage) INTO v_first_stage
  FROM public.vendor_approval_progress p
  LEFT JOIN public.approval_matrix_levels l ON l.id = p.level_id
  WHERE p.vendor_id = _vendor_id
  ORDER BY p.level_number ASC
  LIMIT 1;

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
