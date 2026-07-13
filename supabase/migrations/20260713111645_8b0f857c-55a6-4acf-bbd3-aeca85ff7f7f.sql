
-- 1) Tighten reference-number stamping to only real submit transitions
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
BEGIN
  -- Never re-number if already assigned
  IF NEW.reference_number IS NOT NULL AND length(NEW.reference_number) > 0 THEN
    RETURN NEW;
  END IF;

  -- Detect a real submit transition
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = 'buyer_review' THEN
      v_is_submit := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status::text = 'buyer_review'
       AND OLD.status::text IN (
         'draft',
         'validation_pending',
         'validation_failed',
         'returned_to_vendor',
         'returned_to_buyer'
       ) THEN
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
  RETURN NEW;
END;
$function$;

-- 2) Ensure buyer on-behalf submissions get today's ref before advancing stage
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
  v_existing_ref text;
  v_date date;
  v_seq integer;
BEGIN
  SELECT tenant_id,
         COALESCE(is_msme_registered, false),
         (COALESCE(vendor_type,'domestic') = 'international'),
         reference_number
    INTO v_tenant, v_msme, v_intl, v_existing_ref
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

  -- If buyer submitted on-behalf and no ref yet, stamp today's IST date now
  IF v_on_behalf AND (v_existing_ref IS NULL OR length(v_existing_ref) = 0) THEN
    v_date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
    INSERT INTO public.vendor_reference_counters AS c (date, last_seq, updated_at)
    VALUES (v_date, 1, now())
    ON CONFLICT (date) DO UPDATE
      SET last_seq = c.last_seq + 1,
          updated_at = now()
    RETURNING last_seq INTO v_seq;

    UPDATE public.vendors
    SET reference_number = to_char(v_date, 'YYYYMMDD') || lpad(v_seq::text, 3, '0')
    WHERE id = _vendor_id
      AND (reference_number IS NULL OR length(reference_number) = 0);
  END IF;

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
