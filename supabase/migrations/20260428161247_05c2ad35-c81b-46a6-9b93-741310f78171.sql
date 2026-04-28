ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS primary_phone_2 text,
  ADD COLUMN IF NOT EXISTS primary_email_2 text;