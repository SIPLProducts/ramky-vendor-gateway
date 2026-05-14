UPDATE public.api_providers
SET
  request_body_template = jsonb_build_object(
    'id_number', '{{id_number}}',
    'ifsc', '{{ifsc}}',
    'ifsc_details', true
  ),
  response_data_mapping = jsonb_build_object(
    'account_number', 'data.account_number',
    'account_exists', 'data.account_exists',
    'full_name', 'data.full_name',
    'name_at_bank', 'data.full_name',
    'ifsc', 'data.ifsc_details.ifsc',
    'bank_name', 'data.ifsc_details.bank_name',
    'branch_name', 'data.ifsc_details.branch',
    'branch_address', 'data.ifsc_details.address',
    'branch_city', 'data.ifsc_details.city',
    'branch_state', 'data.ifsc_details.state',
    'micr', 'data.ifsc_details.micr',
    'imps_ref_no', 'data.imps_ref_no'
  ),
  response_success_path = 'success',
  response_success_value = 'true',
  response_message_path = 'message',
  updated_at = now()
WHERE provider_name = 'BANK';