UPDATE public.api_providers
SET response_data_mapping = jsonb_build_object(
  'account_number', 'data.account_number.value',
  'ifsc_code',      'data.ifsc_code.value',
  'micr',           'data.micr.value'
)
WHERE provider_name = 'BANK_OCR';