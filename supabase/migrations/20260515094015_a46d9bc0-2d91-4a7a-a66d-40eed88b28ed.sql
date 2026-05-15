-- 1. Default created_by to auth.uid() so any new invitation auto-captures inviter
ALTER TABLE public.vendor_invitations
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 2. Safety-net trigger: if app/RPC inserts NULL but a JWT user is present, backfill it
CREATE OR REPLACE FUNCTION public.set_invitation_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendor_invitations_set_created_by ON public.vendor_invitations;
CREATE TRIGGER trg_vendor_invitations_set_created_by
BEFORE INSERT ON public.vendor_invitations
FOR EACH ROW
EXECUTE FUNCTION public.set_invitation_created_by();