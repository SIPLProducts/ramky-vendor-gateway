## Problem

Uploading a GST PDF in the Vendor Registration form hits `kyc-api-execute`, which returns **HTTP 500** with body:

```
{"found":false,"ok":false,"message":"path.split is not a function"}
```

The UI shows the generic "GST OCR provider not configured" toast because the client treats any non-`found` response as "not configured". Two root causes:

### Root cause 1 — Edge function crash on bad mapping
`supabase/functions/kyc-api-execute/index.ts` `getPath(obj, path)` does `path.split(".")` without checking `typeof path === "string"`. One bad entry in `response_data_mapping` crashes the entire request.

### Root cause 2 — Misconfigured providers in DB
Both `GST_OCR` and `PAN_OCR` have an entire **sample upstream response** saved into `response_data_mapping` instead of a `{ outKey: "json.path" }` map. Example (current GST_OCR):

```json
{ "data": { "gstin": "37ABDCS6352G1Z7", "legal_name": "...", ... }, "success": true }
```

It should be:

```json
{ "gstin": "data.gstin", "legal_name": "data.legal_name", "pan_number": "data.pan_number", "business_name": "data.business_name", "address": "data.address", "gstin_status": "data.gstin_status" }
```

Same shape problem for `PAN_OCR` (Surepass nests fields under `data.ocr_fields[0].<field>.value`).

### Root cause 3 — Client misreads non-500 errors as "not configured"
`PanKycTab.tsx` (and the GST/MSME/Bank tabs use the same pattern via `useProviderVerify`) treat `!r.found` as "provider not configured". When the edge function returns `found:false` because of a runtime error, the user sees the wrong message and never learns that the upstream call actually returned `success:false` / a real error.

## Fix plan

### 1. Harden `supabase/functions/kyc-api-execute/index.ts`
- `getPath`: return `undefined` immediately when `typeof path !== "string"` or string is empty.
- Wrap the `response_data_mapping` loop in a try/catch per-key so one bad mapping entry never aborts the whole call. Log the offending key.
- Distinguish three outcomes in the JSON response:
  - `found:false` → only when no enabled provider row exists.
  - `found:true, ok:false` → upstream returned non-success or 4xx/5xx; include `message`, `status_code`, `message_code`, `raw`.
  - `found:true, ok:true` → success.
- Catch the top-level `try` and return **HTTP 200** with `found:true, ok:false, message: e.message` so the client can render the real error instead of a generic 500/"not configured".

### 2. Repair provider configs (DB migration)
Create a migration that **rewrites** `response_data_mapping`, `response_success_path`, `response_message_path` for the four OCR providers:

- `GST_OCR` → maps `data.gstin`, `data.legal_name`, `data.business_name`, `data.pan_number`, `data.address`, `data.gstin_status`, `data.constitution_of_business`, `data.date_of_registration`, `data.taxpayer_type`.
- `PAN_OCR` → maps `data.ocr_fields.0.pan_number.value` → `pan_number`, `data.ocr_fields.0.full_name.value` → `full_name`, `data.ocr_fields.0.father_name.value` → `father_name`, `data.ocr_fields.0.dob.value` → `dob`.
- `MSME_OCR` and `BANK_OCR` — inspect existing rows and apply the same correction (script will fall back to no-op if row is absent).
- Set `response_success_path = "success"`, `response_message_path = "message"` (already matches Surepass).

This migration is idempotent (uses `UPDATE ... WHERE provider_name = ...`).

### 3. Improve client error surfacing
- `src/components/vendor/kyc/PanKycTab.tsx`, `GstKycTab.tsx`, `MsmeKycTab.tsx`, `BankKycTab.tsx`, and the registration-step shim in `DocumentVerificationStep.tsx`: stop conflating `!found` with "provider not configured". Only show the "Add it in KYC & Validation API Settings" message when `found === false` AND `message_code` is null. Otherwise show the actual `r.message` from the upstream API (e.g. `no_gstin_detected`, `path.split is not a function` while we're debugging).
- `src/lib/kycToast.ts` already shows `provider · message_code · status` — keep, but make the title use `r.message` when `ok=false` so the toast clearly reads "GST failed — no_gstin_detected · via Surepass · status 200" instead of "provider not configured".

### 4. Verify after deploy
- Redeploy `kyc-api-execute`.
- Re-upload SIPL GST Certificate → expect the toast to show `GST OCR success · via Surepass · message_code: success · status 200` and the form to fill GSTIN/Legal Name from `data.gstin` / `data.legal_name`.
- If Surepass returns `success:false`, the toast will show the upstream `message_code` (e.g. `no_gstin_detected`) instead of "not configured".

## Files touched

- `supabase/functions/kyc-api-execute/index.ts` — guard `getPath`, per-key try/catch, top-level error → HTTP 200 with `ok:false`.
- New migration — fix `response_data_mapping` for `GST_OCR`, `PAN_OCR`, `MSME_OCR`, `BANK_OCR`.
- `src/lib/kycToast.ts` — better error title.
- `src/components/vendor/kyc/{Gst,Pan,Msme,Bank}KycTab.tsx` and `src/components/vendor/steps/DocumentVerificationStep.tsx` — distinguish "not configured" vs "upstream error", show real message.

No schema changes, no new tables, no auth changes.
