UPDATE public.api_providers SET response_data_mapping = '{
  "pan_number": "data.ocr_fields.0.pan_number.value",
  "full_name": "data.ocr_fields.0.full_name.value",
  "father_name": "data.ocr_fields.0.father_name.value",
  "dob": "data.ocr_fields.0.dob.value",
  "document_type": "data.ocr_fields.0.document_type",
  "client_id": "data.client_id"
}'::jsonb WHERE provider_name = 'PAN_OCR';

UPDATE public.api_providers SET response_data_mapping = '{
  "gstin": "data.ocr_fields.0.gstin.value",
  "document_type": "data.ocr_fields.0.document_type",
  "client_id": "data.client_id"
}'::jsonb WHERE provider_name = 'GST_OCR';

UPDATE public.api_providers SET response_data_mapping = '{
  "account_number": "data.account_number.value",
  "ifsc_code": "data.ifsc_code.value",
  "micr": "data.micr.value",
  "client_id": "data.client_id"
}'::jsonb WHERE provider_name = 'BANK';