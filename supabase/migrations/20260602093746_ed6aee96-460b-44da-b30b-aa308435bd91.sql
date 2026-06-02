ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS msme_enterprise_name text,
  ADD COLUMN IF NOT EXISTS msme_major_activity text;
