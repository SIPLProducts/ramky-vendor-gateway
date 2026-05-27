UPDATE public.sap_api_configs
SET middleware_url = regexp_replace(middleware_url, '^(https?);//', '\1://')
WHERE middleware_url ~ '^(https?);//';

UPDATE public.sap_api_configs
SET middleware_url = regexp_replace(middleware_url, '^(https?):/([^/])', '\1://\2')
WHERE middleware_url ~ '^(https?):/[^/]';