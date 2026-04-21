CREATE OR REPLACE FUNCTION public.claim_invitation(_token text, _vendor_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  email text,
  used_at timestamp with time zone,
  vendor_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invite RECORD;
  _jwt_email text;
BEGIN
  _jwt_email := auth.jwt() ->> 'email';

  IF _jwt_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT vi.* INTO _invite
  FROM public.vendor_invitations vi
  WHERE vi.token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF lower(_invite.email) <> lower(_jwt_email) THEN
    RAISE EXCEPTION 'Invitation email mismatch';
  END IF;

  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  UPDATE public.vendor_invitations vi
  SET used_at = COALESCE(vi.used_at, now()),
      vendor_id = COALESCE(_vendor_id, vi.vendor_id),
      user_id = COALESCE(vi.user_id, auth.uid())
  WHERE vi.token = _token;

  RETURN QUERY
  SELECT vi.id, vi.email, vi.used_at, vi.vendor_id
  FROM public.vendor_invitations vi
  WHERE vi.token = _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_invitation(text, uuid) TO authenticated;