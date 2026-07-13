-- 1) Add lock column so we know when the reference number was frozen at real submit
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS submit_ref_locked_at timestamptz;

-- 2) Rewrite reference-number trigger function
CREATE OR REPLACE FUNCTION public.assign_vendor_reference_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_date date;
  v_seq integer;
  v_is_submit boolean := false;
  v_review_statuses text[] := ARRAY[
    'buyer_review','scm_manager_review','scm_head_review',
    'finance_1_review','finance_2_review','ceo_office_review'
  ];
  v_presubmit_statuses text[] := ARRAY[
    'draft','validation_pending','validation_failed',
    'returned_to_vendor','returned_to_buyer'
  ];
BEGIN
  -- Freeze forever once a real submit has occurred
  IF NEW.submit_ref_locked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Detect real submit transition
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(v_review_statuses) THEN
      v_is_submit := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status::text = ANY(v_review_statuses)
       AND (OLD.status::text = ANY(v_presubmit_statuses)
            OR OLD.status IS DISTINCT FROM NEW.status AND OLD.submit_ref_locked_at IS NULL) THEN
      -- Any transition into a review status while not yet locked is a real submit
      v_is_submit := true;
    END IF;
  END IF;

  IF NOT v_is_submit THEN
    RETURN NEW;
  END IF;

  v_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  INSERT INTO public.vendor_reference_counters AS c (date, last_seq, updated_at)
  VALUES (v_date, 1, now())
  ON CONFLICT (date) DO UPDATE
    SET last_seq = c.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO v_seq;

  NEW.reference_number := to_char(v_date, 'YYYYMMDD') || lpad(v_seq::text, 3, '0');
  NEW.submit_ref_locked_at := now();
  NEW.submitted_at := COALESCE(NEW.submitted_at, now());
  RETURN NEW;
END;
$function$;

-- 3) Consolidate triggers: keep ONE canonical BEFORE INSERT OR UPDATE trigger
DROP TRIGGER IF EXISTS trg_vendors_assign_reference_number ON public.vendors;
DROP TRIGGER IF EXISTS trg_assign_vendor_reference_number ON public.vendors;
DROP TRIGGER IF EXISTS vendors_reference_number_trigger ON public.vendors;
DROP TRIGGER IF EXISTS assign_vendor_reference_number_trigger ON public.vendors;
DROP TRIGGER IF EXISTS vendors_assign_reference_number ON public.vendors;

CREATE TRIGGER vendors_assign_reference_number
BEFORE INSERT OR UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.assign_vendor_reference_number();

-- 4) Remove on-behalf reference stamping from seed_vendor_approval_progress
CREATE OR REPLACE FUNCTION public.seed_vendor_approval_progress(_vendor_id uuid)
RETURNS TABLE(levels_created integer, vendor_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_msme boolean;
  v_intl boolean;
  v_buyer uuid;
  v_on_behalf boolean := false;
  v_flow public.buyer_approval_flows%ROWTYPE;
  v_has_flow boolean := false;
  v_count integer := 0;
  v_level integer := 0;
  v_first_stage text;
  v_first_status text;
BEGIN
  SELECT tenant_id,
         COALESCE(is_msme_registered, false),
         (COALESCE(vendor_type,'domestic') = 'international')
    INTO v_tenant, v_msme, v_intl
  FROM public.vendors WHERE id = _vendor_id;

  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT 0, NULL::text; RETURN;
  END IF;

  IF v_intl THEN v_msme := false; END IF;

  SELECT vi.created_by, COALESCE(vi.created_on_behalf, false)
    INTO v_buyer, v_on_behalf
  FROM public.vendor_invitations vi
  WHERE vi.vendor_id = _vendor_id
  ORDER BY vi.created_at DESC
  LIMIT 1;

  DELETE FROM public.vendor_approval_progress WHERE vendor_id = _vendor_id;

  IF v_buyer IS NOT NULL THEN
    v_level := v_level + 1;
    IF v_on_behalf THEN
      INSERT INTO public.vendor_approval_progress
        (vendor_id, level_id, level_number, status, stage, acted_by, acted_at, comments, started_at, completed_at)
      VALUES
        (_vendor_id, NULL, v_level, 'approved', 'BUYER', v_buyer, now(),
         'Auto-approved: application submitted by buyer on behalf of vendor', now(), now());
    ELSE
      INSERT INTO public.vendor_approval_progress
        (vendor_id, level_id, level_number, status, stage, started_at)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'BUYER', now());
    END IF;
    v_count := v_count + 1;
  END IF;

  IF v_buyer IS NOT NULL THEN
    SELECT * INTO v_flow FROM public.buyer_approval_flows WHERE buyer_user_id = v_buyer;
    IF FOUND THEN
      v_has_flow := true;
    END IF;
  END IF;

  IF v_has_flow THEN
    IF v_flow.scm_manager_user_id IS NOT NULL AND NOT v_flow.skip_scm_manager THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'SCM_MANAGER');
      v_count := v_count + 1;
    END IF;
    IF v_flow.scm_head_user_id IS NOT NULL AND NOT v_flow.skip_scm_head THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'SCM_HEAD');
      v_count := v_count + 1;
    END IF;
    IF v_flow.finance_1_user_id IS NOT NULL AND NOT v_flow.skip_finance_1 THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'FINANCE_1');
      v_count := v_count + 1;
    END IF;
    IF v_flow.finance_2_user_id IS NOT NULL AND NOT v_flow.skip_finance_2 THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'FINANCE_2');
      v_count := v_count + 1;
    END IF;
    IF v_flow.ceo_office_user_id IS NOT NULL AND v_msme THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'CEO_OFFICE');
      v_count := v_count + 1;
    END IF;
  END IF;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::text; RETURN;
  END IF;

  SELECT stage INTO v_first_stage
  FROM public.vendor_approval_progress
  WHERE vendor_id = _vendor_id AND status = 'pending'
  ORDER BY level_number ASC LIMIT 1;

  IF v_first_stage IS NOT NULL THEN
    UPDATE public.vendor_approval_progress
    SET started_at = COALESCE(started_at, now())
    WHERE vendor_id = _vendor_id
      AND status = 'pending'
      AND level_number = (
        SELECT MIN(level_number) FROM public.vendor_approval_progress
        WHERE vendor_id = _vendor_id AND status = 'pending'
      );
  END IF;

  v_first_status := CASE v_first_stage
    WHEN 'BUYER'       THEN 'buyer_review'
    WHEN 'SCM_MANAGER' THEN 'scm_manager_review'
    WHEN 'SCM_HEAD'    THEN 'scm_head_review'
    WHEN 'FINANCE_1'   THEN 'finance_1_review'
    WHEN 'FINANCE_2'   THEN 'finance_2_review'
    WHEN 'CEO_OFFICE'  THEN 'ceo_office_review'
    ELSE 'pending_sap_sync'
  END;

  UPDATE public.vendors SET status = v_first_status::vendor_status WHERE id = _vendor_id;

  RETURN QUERY SELECT v_count, v_first_status;
END;
$function$;

-- 5) One-time backfill of lock timestamps + clear stale draft-era ref numbers
UPDATE public.vendors
  SET submit_ref_locked_at = submitted_at
  WHERE submitted_at IS NOT NULL
    AND submit_ref_locked_at IS NULL;

UPDATE public.vendors
  SET reference_number = NULL
  WHERE submitted_at IS NULL
    AND submit_ref_locked_at IS NULL
    AND reference_number IS NOT NULL
    AND status::text IN ('draft','validation_pending','validation_failed','returned_to_vendor','returned_to_buyer');
