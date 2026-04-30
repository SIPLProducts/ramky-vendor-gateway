-- Clear hardcoded response field mappings for OCR providers so the
-- KYC executor falls back to surfacing the upstream API response verbatim.
-- The vendor registration UI now renders whatever fields the provider returns
-- (no hardcoded list). Admins can still configure a custom mapping later
-- from the KYC & Validation API Settings screen.
UPDATE public.api_providers
SET response_data_mapping = '{}'::jsonb
WHERE provider_name IN ('GST_OCR', 'PAN_OCR', 'MSME_OCR', 'BANK_OCR');