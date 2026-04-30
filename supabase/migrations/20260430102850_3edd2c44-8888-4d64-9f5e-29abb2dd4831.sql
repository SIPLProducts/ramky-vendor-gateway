
UPDATE public.api_providers
SET response_data_mapping = COALESCE(response_data_mapping, '{}'::jsonb)
  || jsonb_build_object(
    'major_activity',  'data.main_details.major_activity',
    'social_category', 'data.main_details.social_category',
    'pin_code',        'data.main_details.pin',
    'mobile',          'data.main_details.mobile',
    'email',           'data.main_details.email'
  )
WHERE provider_name = 'MSME';

UPDATE public.api_providers
SET response_data_mapping = COALESCE(response_data_mapping, '{}'::jsonb)
  || jsonb_build_object(
    'major_activity',         'data.ocr_fields.0.major_activity.value',
    'organization_type',      'data.ocr_fields.0.organization_type.value',
    'date_of_incorporation',  'data.ocr_fields.0.date_of_incorporation.value'
  )
WHERE provider_name = 'MSME_OCR';
