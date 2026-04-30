UPDATE public.api_providers
SET request_body_template = '{"id_number":"{{id_number}}"}'::jsonb,
    updated_at = now()
WHERE provider_name = 'MSME';