-- Repair OCR provider response_data_mapping that was saved as a sample
-- response object instead of a { outKey: "json.path" } map. This caused
-- kyc-api-execute to throw "path.split is not a function" when uploading
-- a GST/PAN certificate from the Vendor Registration form.

UPDATE public.api_providers
SET response_data_mapping = jsonb_build_object(
      'gstin', 'data.gstin',
      'legal_name', 'data.legal_name',
      'business_name', 'data.business_name',
      'pan_number', 'data.pan_number',
      'address', 'data.address',
      'gst_status', 'data.gstin_status',
      'taxpayer_type', 'data.taxpayer_type',
      'registration_date', 'data.date_of_registration',
      'constitution_of_business', 'data.constitution_of_business',
      'date_of_cancellation', 'data.date_of_cancellation',
      'field_visit_conducted', 'data.field_visit_conducted',
      'aadhaar_validation', 'data.aadhaar_validation',
      'state_jurisdiction', 'data.state_jurisdiction',
      'center_jurisdiction', 'data.center_jurisdiction'
    ),
    response_success_path = COALESCE(NULLIF(response_success_path, ''), 'success'),
    response_message_path = COALESCE(NULLIF(response_message_path, ''), 'message')
WHERE provider_name = 'GST_OCR';

UPDATE public.api_providers
SET response_data_mapping = jsonb_build_object(
      'pan_number',  'data.ocr_fields.0.pan_number.value',
      'full_name',   'data.ocr_fields.0.full_name.value',
      'father_name', 'data.ocr_fields.0.father_name.value',
      'dob',         'data.ocr_fields.0.dob.value'
    ),
    response_success_path = COALESCE(NULLIF(response_success_path, ''), 'success'),
    response_message_path = COALESCE(NULLIF(response_message_path, ''), 'message')
WHERE provider_name = 'PAN_OCR';