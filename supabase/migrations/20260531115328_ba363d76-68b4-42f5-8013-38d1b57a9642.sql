
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
    'scm_manager_review','scm_head_review','finance_1_review','finance_2_review','ceo_office_review'
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status::text = NEW.status::text THEN
    RETURN NEW;
  END IF;

  -- Resubmission after a vendor return: always reseed.
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
