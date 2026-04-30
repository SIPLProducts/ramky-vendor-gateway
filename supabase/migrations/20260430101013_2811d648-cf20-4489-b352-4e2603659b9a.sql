UPDATE public.api_providers SET response_data_mapping = '{"account_number":"data.account_number.value","ifsc_code":"data.ifsc_code.value","micr":"data.micr.value"}'::jsonb WHERE provider_name='BANK_OCR';

UPDATE public.api_providers SET response_data_mapping = '{"account_number":"data.account_number","ifsc_code":"data.ifsc","name_at_bank":"data.full_name","bank_name":"data.bank_name","branch_name":"data.branch"}'::jsonb WHERE provider_name='BANK';

UPDATE public.api_providers SET
  base_url='https://kyc-api.surepass.app',
  endpoint_path='/api/v1/ocr/udyam-aadhaar',
  request_mode='multipart',
  http_method='POST',
  file_field_name='file',
  request_body_template='{}'::jsonb,
  response_data_mapping='{"udyam_number":"data.ocr_fields.0.uam.value","enterprise_name":"data.ocr_fields.0.enterprise_name.value","enterprise_type":"data.ocr_fields.0.enterprise_type.value"}'::jsonb
WHERE provider_name='MSME_OCR';

UPDATE public.api_providers SET response_data_mapping = '{"udyam_number":"data.reference_id","enterprise_name":"data.main_details.name_of_enterprise","enterprise_type":"data.main_details.enterprise_type_list.0.enterprise_type","state":"data.main_details.state","district":"data.main_details.dic_name","registration_date":"data.main_details.registration_date","organization_type":"data.main_details.organization_type"}'::jsonb WHERE provider_name='MSME';