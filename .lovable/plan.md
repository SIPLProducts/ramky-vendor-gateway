## Root cause (confirmed from screenshots + DB)

The vendor uploads a PDF → frontend calls `kyc-api-execute` correctly with `fileBase64` + `fileMimeType` → edge function reaches Surepass `https://kyc-api.surepass.app/api/v1/ocr/gst` → **Surepass replies HTTP 400**.

Why Surepass rejects it:

1. The DB row for `GST_OCR` (and `PAN_OCR`) is `request_mode = "multipart"` **but** also has `request_headers = { "Content-Type": "application/json" }`.
2. The edge function copies that header in, then builds a `FormData` body. Forcing `Content-Type: application/json` on a multipart request stops `fetch` from writing the required `multipart/form-data; boundary=...` header → Surepass receives a malformed body → **400**.
3. The edge function then can't parse the (HTML/text) error body, so it returns `raw: null` and a generic `"HTTP 400"` — which is exactly what your screenshot shows. Nothing is hardcoded; the upstream really did fail.

So this is **not** a hardcoding problem. It's a config + header-handling bug. The UI is already 100% dynamic.

## Fix

### 1. `supabase/functions/kyc-api-execute/index.ts`
- When `request_mode === "multipart"`, **strip any `Content-Type` header** from the merged headers before fetch (let the runtime set the multipart boundary automatically).
- Always populate `raw` with the upstream body — if it's not JSON, return the raw text string so the UI can show Surepass's actual error message (instead of `raw: null`).
- Keep the existing dynamic mapping fallback (no field hardcoding).

### 2. Repair the DB rows (migration)
For OCR providers (`GST_OCR`, `PAN_OCR`, `MSME_OCR`, `BANK_OCR`):
- Remove `Content-Type` from `request_headers` (multipart sets it itself).
- Keep `request_mode = 'multipart'`, `file_field_name = 'file'`.
- Leave `response_data_mapping = '{}'` so the UI keeps showing whatever Surepass returns, field-for-field.

### 3. No code changes to:
- `useConfiguredKycApi.tsx` — already sends `fileBase64` + `fileMimeType` correctly.
- `ApiResponseDetails.tsx` — already renders the upstream payload dynamically.
- KYC tabs — already pass through the raw `apiResult`.

## Files touched
- `supabase/functions/kyc-api-execute/index.ts` (multipart header fix + raw text passthrough)
- New migration: clear bad `Content-Type` from OCR providers' `request_headers`

## How to verify after deploy
- Re-upload the same GST PDF.
- `kyc-api-execute` returns 200; `raw` now contains Surepass's real JSON (or its real error message), and the UI's "API response" card shows every field Surepass returned with no hardcoded labels.