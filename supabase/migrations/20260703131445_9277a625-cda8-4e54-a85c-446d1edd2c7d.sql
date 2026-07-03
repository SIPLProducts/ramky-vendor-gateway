ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS vendor_cashflow text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier_category text[] NOT NULL DEFAULT '{}';