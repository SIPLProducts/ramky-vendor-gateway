ALTER TABLE public.vendor_invitations 
ADD COLUMN IF NOT EXISTS vendor_name text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);