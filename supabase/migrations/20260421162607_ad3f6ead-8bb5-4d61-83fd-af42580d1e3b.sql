ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS is_gst_registered boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS gst_declaration_reason text,
  ADD COLUMN IF NOT EXISTS is_msme_registered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_constitution_of_business text,
  ADD COLUMN IF NOT EXISTS gst_principal_place_of_business text,
  ADD COLUMN IF NOT EXISTS gst_additional_places jsonb,
  ADD COLUMN IF NOT EXISTS gst_registration_date date,
  ADD COLUMN IF NOT EXISTS gst_status text,
  ADD COLUMN IF NOT EXISTS gst_taxpayer_type text,
  ADD COLUMN IF NOT EXISTS gst_business_nature text[],
  ADD COLUMN IF NOT EXISTS gst_jurisdiction_centre text,
  ADD COLUMN IF NOT EXISTS gst_jurisdiction_state text;