UPDATE public.api_providers
SET request_body_template = COALESCE(request_body_template, '{}'::jsonb) || '{"strict_check_name":"true"}'::jsonb,
    updated_at = now()
WHERE provider_name = 'PAN_OCR';