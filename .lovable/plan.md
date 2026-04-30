# Route GST & PAN in vendor registration through KYC API Settings

## Root cause (why no network call to Surepass today)

The vendor registration form's Step 1 renders `DocumentVerificationStep.tsx`, **not** the `GstKycTab` / `PanKycTab` components we refactored earlier. That step still calls `useOcrExtraction()` → `supabase.functions.invoke('ocr-extract')`, which uses **Gemini 2.5 Flash via Lovable AI Gateway**. The configured Surepass GST_OCR / PAN_OCR providers in KYC API Settings are never reached, which is why no request to `https://kyc-api.surepass.app/api/v1/ocr/gst` shows up in the network tab.

DB state (verified):
- `GST_OCR` (Surepass `/api/v1/ocr/gst`, Bearer, multipart, `file`) — enabled, token saved
- `PAN_OCR` (Surepass `/api/v1/ocr/pan`, Bearer, multipart, `file`) — enabled, token saved
- `MSME` and `BANK` validation entries also present

So the providers are configured correctly; only the wiring in `DocumentVerificationStep` is wrong.

## What we'll change

### 1. `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Remove the `useOcrExtraction` (Gemini) import and usage.
- Add a single `runConfiguredOcr(providerName, file)` helper that calls `useConfiguredKycApi.callProvider({ providerName, file })` (which invokes the `kyc-api-execute` edge function → Surepass).
- Replace every place that currently does `extractFromFile(file, kind)` with the configured-provider call:
  - GST stage → `runConfiguredOcr('GST_OCR', file)`
  - PAN stage → `runConfiguredOcr('PAN_OCR', file)`
  - MSME stage → `runConfiguredOcr('MSME_OCR', file)` (will show a "not configured" toast until the admin adds it)
  - Bank stage → `runConfiguredOcr('BANK_OCR', file)` (same)
- Map the returned data into the existing `ocrData` shape the component already uses (`gstin`, `legal_name`, `pan_number`, `holder_name`, `udyam_number`, `account_number`, `ifsc_code`, etc.). The `response_data_mapping` already configured in the DB returns these exact keys, so the change is mostly a drop-in.
- For the PAN OCR mapping (`data.ocr_fields.0.full_name.value` etc.), expose it as `holder_name` so the rest of the file (which expects `holder_name`) keeps working — done by adjusting either the mapping or by aliasing in the helper.
- After OCR success, call `toastKycResult('GST OCR' | 'PAN OCR' | …, r)` so the upstream `message_code` (e.g. `success`, `no_gstin_detected`) and `status_code` (200 / 422) are visible in a sonner toast — this is the proof that the call actually went through Surepass and not Gemini.
- If `r.found === false` (admin hasn't added that provider), show a clear toast: *"GST OCR provider not configured. Add it in KYC & Validation API Settings."* and mark the stage as failed instead of falling back to Gemini.
- Drop the `ocrModel` "Verified by Gemini" badge — replace with the upstream `provider_name` returned by the edge function.

### 2. `supabase/functions/kyc-api-execute/index.ts` — small hardening
- When the upstream Surepass response has `success: false` (e.g. `{"status_code":422,"message_code":"no_gstin_detected","success":false}`), return `ok: false` AND populate `message` from `message` / `message_code` so the toast says exactly *"GST OCR failed — No GSTIN Detected · via GST OCR · message_code: no_gstin_detected · status 422"*. Today the function partly does this; we'll make sure `message` always falls back to the upstream `message` field before the generic `HTTP 422`.
- No schema changes needed.

### 3. KYC API Settings — no config change required by the user
The two providers are already correct (URL, Bearer token, multipart with field name `file`, enabled). The 422 response in the Postman screenshot is Surepass telling us *"the uploaded PDF didn't contain a readable GSTIN"* — that's a real provider response, not a config bug. Once Step 1 is rewired, the same 422 will surface in the app as a clear failed toast (instead of silently being replaced by a Gemini hallucination).

Optional clean-up the user can do later in KYC API Settings:
- Add `MSME_OCR` and `BANK_OCR` rows from the templates (one click on the "MSME / Udyam OCR" and "Cancelled Cheque OCR" buttons) and paste the same Bearer token, so MSME and Bank stages also stop using Gemini.

### 4. Remove the legacy fallback path
- Mark `src/hooks/useOcrExtraction.tsx` as deprecated (kept for now only because the demo / showcase pages still import it). Add a top-of-file comment so no one re-introduces it into the registration flow.

## Technical details

Edge-function call already in place:

```ts
// useConfiguredKycApi.callProvider → POST /functions/v1/kyc-api-execute
// → looks up api_providers row by provider_name
// → fetches Surepass with Authorization: Bearer <api_credentials.API_TOKEN>
// → returns { found, ok, status_code, success, message_code, provider_name, data, raw }
```

DocumentVerificationStep replacement (illustrative):

```ts
const { callProvider } = useConfiguredKycApi();

const runConfiguredOcr = async (providerName: string, file: File, label: string) => {
  const r = await callProvider({ providerName, file });
  toastKycResult(label, r);
  if (!r.found) return { ok: false, error: `${label} provider not configured` };
  if (!r.ok || !r.data) return { ok: false, error: r.message || `${label} failed` };
  return { ok: true, extracted: r.data, providerName: r.provider_name };
};

// GST stage onChange:
const ocr = await runConfiguredOcr('GST_OCR', file, 'GST OCR');
```

## Files touched
- edit `src/components/vendor/steps/DocumentVerificationStep.tsx` (main rewire — ~6 call sites)
- edit `supabase/functions/kyc-api-execute/index.ts` (message fallback)
- edit `src/hooks/useOcrExtraction.tsx` (deprecation header only)

## Out of scope
- Switching the Showcase / Demo pages off Gemini.
- Adding new validation providers — existing GST_OCR/PAN_OCR responses already include the validated record (legal_name, pan_number, etc.), so a separate `GST` validation call is not needed.

## How you'll verify it's working after approval
1. Open Vendor Registration → Step 1 → upload a GST certificate.
2. Network tab will show a POST to `…/functions/v1/kyc-api-execute` (the edge function), and the function logs will show the outbound POST to `https://kyc-api.surepass.app/api/v1/ocr/gst`.
3. A sonner toast will display e.g. `GST OCR success · via GST OCR · message_code: success · status 200` (or the 422 / `no_gstin_detected` case from your Postman test).
4. The Gemini "Verified by Gemini 2.5 Flash" badge will be gone.
