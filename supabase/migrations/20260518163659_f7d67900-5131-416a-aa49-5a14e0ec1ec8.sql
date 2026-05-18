
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_type text NOT NULL DEFAULT 'domestic',
  ADD COLUMN IF NOT EXISTS international_data jsonb;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_vendor_type_check CHECK (vendor_type IN ('domestic','international'));
