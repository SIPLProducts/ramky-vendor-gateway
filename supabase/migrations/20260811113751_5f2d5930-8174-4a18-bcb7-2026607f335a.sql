ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_invitation_id_fkey;
ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_invitation_id_fkey
  FOREIGN KEY (invitation_id) REFERENCES public.vendor_invitations(id) ON DELETE SET NULL;