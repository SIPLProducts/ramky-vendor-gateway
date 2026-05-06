UPDATE public.api_providers
SET response_data_mapping = response_data_mapping || jsonb_build_object(
  'classification_year', 'data.main_details.enterprise_type_list.0.classification_year'
)
WHERE provider_name = 'MSME';