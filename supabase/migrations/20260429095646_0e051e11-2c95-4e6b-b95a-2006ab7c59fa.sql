REVOKE EXECUTE ON FUNCTION public.list_smtp_configs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_smtp_configs() TO authenticated;