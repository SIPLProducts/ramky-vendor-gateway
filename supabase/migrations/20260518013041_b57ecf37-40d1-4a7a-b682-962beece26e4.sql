
-- Authoritative seeder for vendor approval progress
CREATE OR REPLACE FUNCTION public.seed_vendor_approval_progress(_vendor_id uuid)
RETURNS TABLE(levels_created integer, vendor_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_msme boolean;
  v_first_stage text;
  v_first_status text;
  v_count integer := 0;
BEGIN
  SELECT tenant_id, COALESCE(is_msme_registered, false)
    INTO v_tenant, v_msme
  FROM public.vendors WHERE id = _vendor_id;

  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT 0, NULL::text;
    RETURN;
  END IF;

  -- Wipe any existing chain
  DELETE FROM public.vendor_approval_progress WHERE vendor_id = _vendor_id;

  -- Build canonical ordered, renumbered chain and capture first stage
  WITH ordered AS (
    SELECT
      l.id AS level_id,
      l.stage,
      l.level_number AS original_level_number,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE l.stage
            WHEN 'SCM_MANAGER' THEN 1
            WHEN 'SCM_HEAD'    THEN 2
            WHEN 'FINANCE_1'   THEN 3
            WHEN 'FINANCE_2'   THEN 4
            WHEN 'CEO_OFFICE'  THEN 5
            ELSE 99
          END,
          l.level_number
      ) AS new_level_number
    FROM public.approval_matrix_levels l
    WHERE l.tenant_id = v_tenant
      AND l.is_active = true
      AND (l.requires_msme = false OR v_msme = true)
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

  -- First stage to flip vendor.status into
  SELECT l.stage
    INTO v_first_stage
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
$$;

-- Trigger function: seed on status transition into review stage when chain is empty
CREATE OR REPLACE FUNCTION public.trg_vendors_seed_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists integer;
BEGIN
  IF NEW.status::text NOT IN (
    'scm_manager_review','scm_head_review','finance_1_review','finance_2_review','ceo_office_review'
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status::text = NEW.status::text THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_exists FROM public.vendor_approval_progress WHERE vendor_id = NEW.id;
  IF v_exists > 0 THEN
    RETURN NEW;
  END IF;

  PERFORM public.seed_vendor_approval_progress(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_seed_approval ON public.vendors;
CREATE TRIGGER vendors_seed_approval
AFTER INSERT OR UPDATE OF status ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.trg_vendors_seed_approval();
