
UPDATE public.sap_payload_templates
SET template = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(template,
              '{street}',     '"{{vendor.registered_address|trunc:60}}"'::jsonb),
            '{house_no}',     '""'::jsonb),
          '{str_suppl1}',     '"{{vendor.registered_address_line2|trunc:40}}"'::jsonb),
        '{str_suppl2}',       '"{{vendor.registered_address_line3|trunc:40}}"'::jsonb),
      '{str_suppl3}',         '"{{vendor.registered_address_line4|trunc:40}}"'::jsonb),
    '{location}',             '""'::jsonb),
  '{district}',               '""'::jsonb)
WHERE is_active = true;

UPDATE public.sap_payload_templates
SET template = jsonb_set(template, '{vendors,0}',
  (template->'vendors'->0)
  || jsonb_build_object(
    'street',     '{{vendor.registered_address|trunc:60}}',
    'house_no',   '',
    'str_suppl1', '{{vendor.registered_address_line2|trunc:40}}',
    'str_suppl2', '{{vendor.registered_address_line3|trunc:40}}',
    'str_suppl3', '{{vendor.registered_address_line4|trunc:40}}',
    'location',   '',
    'district',   ''
  )
)
WHERE is_active = true AND jsonb_typeof(template->'vendors') = 'array';
