
-- Add missing penny drop columns to vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS pennydrop_status jsonb,
ADD COLUMN IF NOT EXISTS pennydrop_verification_status text,
ADD COLUMN IF NOT EXISTS pennydrop_init boolean DEFAULT false;

-- Add missing columns to vendor_invitations table
ALTER TABLE public.vendor_invitations
ADD COLUMN IF NOT EXISTS user_id uuid,
ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0;
