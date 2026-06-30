UPDATE public.sap_payload_templates
SET template = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          template,
          '{vendors,0,smtp_addr}', '"{{vendor.primary_email_or_fallback|trunc:241}}"'::jsonb
        ),
        '{vendors,0,smtp_addr2}', '"{{vendor.secondary_email_value|trunc:241}}"'::jsonb
      ),
      '{vendors,0,mob_number}', '"{{vendor.primary_phone_or_fallback|trunc:30}}"'::jsonb
    ),
    '{vendors,0,mob_number2}', '"{{vendor.secondary_phone_value|trunc:30}}"'::jsonb, true
  ),
  '{mob_number2}', '"{{vendor.secondary_phone_value|trunc:30}}"'::jsonb, true
),
updated_at = now()
WHERE is_active = true;