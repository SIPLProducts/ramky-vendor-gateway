ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS registered_contact_1 text,
  ADD COLUMN IF NOT EXISTS registered_contact_2 text,
  ADD COLUMN IF NOT EXISTS registered_email_2 text;