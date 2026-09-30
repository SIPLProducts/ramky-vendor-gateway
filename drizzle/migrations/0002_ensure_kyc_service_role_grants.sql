GRANT SELECT ON TABLE public.api_providers TO service_role;
GRANT SELECT ON TABLE public.api_credentials TO service_role;
NOTIFY pgrst, 'reload schema';