CREATE OR REPLACE FUNCTION public.record_invitation_access(_token text)
RETURNS TABLE(
  id uuid,
  email text,
  expires_at timestamp with time zone,
  used_at timestamp with time zone,
  tenant_id uuid,
  vendor_name text,
  phone_number text,
  access_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.vendor_invitations
  SET access_count = COALESCE(access_count, 0) + 1
  WHERE token = _token;

  RETURN QUERY
  SELECT vi.id, vi.email, vi.expires_at, vi.used_at, vi.tenant_id,
         vi.vendor_name, vi.phone_number, vi.access_count
  FROM public.vendor_invitations vi
  WHERE vi.token = _token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_invitation_access(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;