ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS registered_address_line4 text,
  ADD COLUMN IF NOT EXISTS registered_email text,
  ADD COLUMN IF NOT EXISTS manufacturing_address_line4 text,
  ADD COLUMN IF NOT EXISTS manufacturing_email text,
  ADD COLUMN IF NOT EXISTS branch_address_line2 text,
  ADD COLUMN IF NOT EXISTS branch_address_line3 text,
  ADD COLUMN IF NOT EXISTS branch_address_line4 text,
  ADD COLUMN IF NOT EXISTS branch_email text;