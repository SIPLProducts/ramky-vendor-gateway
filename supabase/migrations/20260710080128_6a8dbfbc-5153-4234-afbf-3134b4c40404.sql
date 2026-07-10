
CREATE OR REPLACE FUNCTION public.assign_vendor_reference_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_date date;
  v_seq integer;
BEGIN
  -- If already assigned, never re-number
  IF NEW.reference_number IS NOT NULL AND length(NEW.reference_number) > 0 THEN
    RETURN NEW;
  END IF;

  -- Only assign when the row is in a submitted / review / synced state.
  -- Drafts (and any other pre-submit state) get NO number.
  IF NEW.status::text NOT IN (
    'buyer_review',
    'scm_manager_review',
    'scm_head_review',
    'finance_1_review',
    'finance_2_review',
    'ceo_office_review',
    'pending_sap_sync',
    'sap_synced'
  ) THEN
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

-- Replace the BEFORE INSERT trigger with BEFORE INSERT OR UPDATE.
DROP TRIGGER IF EXISTS assign_vendor_reference_number_trigger ON public.vendors;
DROP TRIGGER IF EXISTS trg_assign_vendor_reference_number ON public.vendors;
DROP TRIGGER IF EXISTS vendors_assign_reference_number ON public.vendors;
DROP TRIGGER IF EXISTS vendors_reference_number_trigger ON public.vendors;

CREATE TRIGGER vendors_assign_reference_number
BEFORE INSERT OR UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.assign_vendor_reference_number();
