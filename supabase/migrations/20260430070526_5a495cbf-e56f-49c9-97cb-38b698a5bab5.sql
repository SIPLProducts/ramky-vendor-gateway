UPDATE public.api_providers
SET request_headers = '{}'::jsonb
WHERE provider_name IN ('PAN_OCR','GST_OCR','MSME_OCR','BANK_OCR')
  AND request_mode = 'multipart';