
-- Counter table for daily reference number sequencing
CREATE TABLE IF NOT EXISTS public.vendor_reference_counters (
  date date PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.vendor_reference_counters TO service_role;
ALTER TABLE public.vendor_reference_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only accessed via SECURITY DEFINER trigger.

-- Add reference_number column to vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS reference_number text UNIQUE;

-- Trigger function: assign YYYYMMDD### reference number on insert
CREATE OR REPLACE FUNCTION public.assign_vendor_reference_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_seq integer;
BEGIN
  IF NEW.reference_number IS NOT NULL AND length(NEW.reference_number) > 0 THEN
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
$$;

DROP TRIGGER IF EXISTS trg_vendors_assign_reference_number ON public.vendors;
CREATE TRIGGER trg_vendors_assign_reference_number
BEFORE INSERT ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.assign_vendor_reference_number();

-- Backfill existing vendors that have no reference_number
DO $$
DECLARE
  r record;
  v_date date;
  v_seq integer;
BEGIN
  FOR r IN
    SELECT id, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS d
    FROM public.vendors
    WHERE reference_number IS NULL
    ORDER BY created_at ASC
  LOOP
    v_date := r.d;
    INSERT INTO public.vendor_reference_counters AS c (date, last_seq, updated_at)
    VALUES (v_date, 1, now())
    ON CONFLICT (date) DO UPDATE
      SET last_seq = c.last_seq + 1,
          updated_at = now()
    RETURNING last_seq INTO v_seq;

    UPDATE public.vendors
    SET reference_number = to_char(v_date, 'YYYYMMDD') || lpad(v_seq::text, 3, '0')
    WHERE id = r.id;
  END LOOP;
END $$;
