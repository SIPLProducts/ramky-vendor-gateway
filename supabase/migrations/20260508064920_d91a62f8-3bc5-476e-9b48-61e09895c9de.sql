ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS material_group_vendor text,
  ADD COLUMN IF NOT EXISTS vendor_category text,
  ADD COLUMN IF NOT EXISTS vendor_location text,
  ADD COLUMN IF NOT EXISTS identification_source text;