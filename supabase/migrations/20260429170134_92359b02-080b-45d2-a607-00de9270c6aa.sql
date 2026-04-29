
-- Extend api_providers for KYC/OCR settings
ALTER TABLE public.api_providers
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'VALIDATION',
  ADD COLUMN IF NOT EXISTS request_mode text NOT NULL DEFAULT 'json',
  ADD COLUMN IF NOT EXISTS file_field_name text;

-- Allow global rows (tenant_id NULL) — already nullable
-- Drop old unique constraint that prevented NULL tenant_id duplicates issue
ALTER TABLE public.api_providers
  DROP CONSTRAINT IF EXISTS api_providers_tenant_id_provider_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS api_providers_tenant_provider_uniq
  ON public.api_providers ((COALESCE(tenant_id::text, '00000000-0000-0000-0000-000000000000')), provider_name);

-- Allow sharvi/admin to read all providers (in addition to tenant-scoped policy)
DROP POLICY IF EXISTS "Sharvi admins can read all API providers" ON public.api_providers;
CREATE POLICY "Sharvi admins can read all API providers"
ON public.api_providers FOR SELECT
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Seed 4 default global rows for KYC settings (idempotent)
INSERT INTO public.api_providers (
  tenant_id, provider_name, display_name, category, base_url, endpoint_path,
  http_method, request_mode, file_field_name, auth_type, auth_header_name, auth_header_prefix,
  request_headers, request_body_template, response_success_path, response_success_value,
  response_message_path, response_data_mapping, is_enabled, execution_order
)
VALUES
  (NULL, 'GST_OCR', 'GST OCR', 'OCR', 'https://kyc-api.surepass.app', '/api/v1/ocr/gst',
   'POST', 'multipart', 'file', 'BEARER_TOKEN', 'Authorization', 'Bearer',
   '{}'::jsonb, '{}'::jsonb, 'success', 'true', 'message',
   '{"gstin":"data.gstin","legalName":"data.legal_name","tradeName":"data.trade_name","address":"data.address"}'::jsonb,
   true, 1),
  (NULL, 'PAN_OCR', 'PAN OCR', 'OCR', 'https://kyc-api.surepass.app', '/api/v1/ocr/pan',
   'POST', 'multipart', 'file', 'BEARER_TOKEN', 'Authorization', 'Bearer',
   '{}'::jsonb, '{}'::jsonb, 'success', 'true', 'message',
   '{"pan":"data.pan","name":"data.name","fatherName":"data.father_name","dob":"data.dob"}'::jsonb,
   true, 2),
  (NULL, 'MSME', 'MSME / Udyog Aadhaar', 'VALIDATION', 'https://kyc-api.surepass.app', '/api/v1/corporate/udyog-aadhaar',
   'POST', 'json', NULL, 'BEARER_TOKEN', 'Authorization', 'Bearer',
   '{}'::jsonb, '{"id_number":"{{msme}}"}'::jsonb, 'success', 'true', 'message',
   '{"udyamNumber":"data.reference_id","enterpriseName":"data.enterprise_name","enterpriseType":"data.enterprise_type","state":"data.state","district":"data.district"}'::jsonb,
   true, 3),
  (NULL, 'BANK', 'Bank Verification', 'VALIDATION', 'https://kyc-api.surepass.app', '/api/v1/bank-verification/',
   'POST', 'json', NULL, 'BEARER_TOKEN', 'Authorization', 'Bearer',
   '{}'::jsonb, '{"id_number":"{{account}}","ifsc":"{{ifsc}}","ifsc_details":true}'::jsonb,
   'success', 'true', 'message',
   '{"accountHolder":"data.full_name","bankName":"data.ifsc_details.bank_name","branch":"data.ifsc_details.branch","ifsc":"data.ifsc"}'::jsonb,
   true, 4)
ON CONFLICT DO NOTHING;
