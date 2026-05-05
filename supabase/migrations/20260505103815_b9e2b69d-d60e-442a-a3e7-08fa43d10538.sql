CREATE OR REPLACE FUNCTION public.check_my_smtp_configured()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smtp_email_configs s
    WHERE lower(s.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND s.is_active = true
      AND s.app_password IS NOT NULL
      AND length(s.app_password) > 0
  );
$$;

REVOKE EXECUTE ON FUNCTION public.check_my_smtp_configured() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_my_smtp_configured() TO authenticated;