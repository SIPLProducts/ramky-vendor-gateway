## Goal

Send `strict_check_name: "true"` as an additional form field in the multipart request to the Surepass PAN OCR endpoint (`https://kyc-api.surepass.app/api/v1/ocr/pan`), without affecting any other provider.

## Why a code change is needed

Today the PAN OCR provider is configured with `request_mode: "multipart"` and `request_body_template: {}`. The edge function `supabase/functions/kyc-api-execute/index.ts` (multipart branch, lines 135–150) only appends the file to `FormData` and ignores `request_body_template` entirely. So even if we set `request_body_template = { strict_check_name: "true" }` in the DB, it would never be sent on the wire.

We need to (a) make the multipart branch forward `request_body_template` fields, and (b) update the default template / existing row for PAN_OCR.

## Changes

### 1. `supabase/functions/kyc-api-execute/index.ts` (multipart branch)

After `fd.append(provider.file_field_name || "file", blob, uploadName);`, iterate `provider.request_body_template` (when it's a plain object) and append each key/value as a form field, applying the same `substitute(...)` placeholder logic already used for JSON mode so `{{...}}` templates keep working. Values are coerced to string; nested objects/arrays are JSON-stringified. Empty/null values are skipped. This is generic and only activates when a provider actually has fields in its template — current GST_OCR / BANK_OCR templates are `{}` so they remain byte-identical on the wire.

Add a log line listing the extra field names (no values) for diagnostics.

### 2. `src/pages/KycApiSettings.tsx` (seed defaults)

Change line 45 for `PAN_OCR` from
`request_body_template: {}`
to
`request_body_template: { strict_check_name: "true" }`
so any fresh "Install defaults" run picks it up. No other provider entry changes.

### 3. DB migration to update the existing PAN_OCR row

New migration `supabase/migrations/<ts>_pan_ocr_strict_check_name.sql`:

```sql
UPDATE public.kyc_api_providers
SET request_body_template = COALESCE(request_body_template, '{}'::jsonb)
                            || '{"strict_check_name":"true"}'::jsonb,
    updated_at = now()
WHERE provider_name = 'PAN_OCR';
```

Uses jsonb merge so any other fields an admin may have added are preserved; only the `strict_check_name` key is set/overwritten.

## Non-impact verification

- Multipart branch change is a no-op for providers whose `request_body_template` is empty (GST_OCR, BANK_OCR today).
- JSON-mode providers (PAN, GST, MSME, BANK, PAN comprehensive) are untouched.
- Response mapping for PAN OCR is unchanged — `strict_check_name` only affects the request payload; Surepass keeps the same response shape (`data.ocr_fields[0]…`).
- The existing PAN OCR → name-match flow in `PanKycTab` / `DocumentVerificationStep` continues to read `full_name` and `pan_number` from the same paths.
- KYC API Settings edit screen already exposes `request_body_template` in the "Request Payload" tab, so admins can see/override the new field if needed.

## Test plan (after switching to build mode)

1. Re-upload a PAN card in the vendor Document Verification step; confirm `kyc-api-execute` logs show `extraFields=strict_check_name` and the OCR result returns `full_name` / `pan_number` as before.
2. Re-upload a GST card and a cheque; confirm logs do NOT show `extraFields` (templates still empty) and OCR still works.
3. In KYC API Settings → PAN OCR → Request Payload tab, confirm the saved JSON shows `{"strict_check_name":"true"}`.
