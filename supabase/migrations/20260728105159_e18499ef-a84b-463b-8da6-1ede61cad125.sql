ALTER TABLE public.vendor_invitations
  ADD COLUMN IF NOT EXISTS original_created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_invitations_original_created_by
  ON public.vendor_invitations(original_created_by);