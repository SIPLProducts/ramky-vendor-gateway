ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pan_status text,
  ADD COLUMN IF NOT EXISTS pan_aadhaar_linked boolean,
  ADD COLUMN IF NOT EXISTS pan_comprehensive_verified_at timestamptz;