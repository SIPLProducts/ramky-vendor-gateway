# Verify KYC API source + surface `message_code` in toasts

## Goal

Make it explicit (and visible to the vendor + admin) that GST / PAN / MSME / Bank verifications are running through the **KYC & Validation API Settings** providers — not the legacy Gemini 2.5 Flash OCR — and surface the API's `message_code` / `status_code` / `success` fields in toaster messages.

## Current state (confirmed)

- All four KYC tabs (`GstKycTab`, `PanKycTab`, `MsmeKycTab`, `BankKycTab`) already call `useConfiguredKycApi.callProvider(...)` → edge function `kyc-api-execute` → admin-configured provider row in `api_providers`.
- `OcrUploadAndVerify` accepts a `runOcr` override; every tab now passes one, so the Gemini-based `useOcrExtraction` (`ocr-extract` edge function) is **never invoked** from the registration flow today.
- `useOcrExtraction` is still imported inside `OcrUploadAndVerify` as a fallback path. It is dead code in this flow but creates ambiguity ("is Gemini still used?").
- `kyc-api-execute` returns `{ found, ok, status, latency_ms, message, data, raw }` but **drops `message_code` / `status_code` / `success`** from the upstream response, so the UI can't display them.
- No success/error toast is shown on verification — only an inline alert. The user has no toast confirming the source/result of the call.

## Changes

### 1. `supabase/functions/kyc-api-execute/index.ts`
- Pass through provider identity + raw status flags so the client can prove the call came from the configured provider:
  - Add `provider_name`, `provider_id`, `endpoint_url` to the response.
  - Add `message_code` (read from `provider.response_message_code_path` if set, else fall back to `raw.message_code`).
  - Always echo upstream `status_code` (from JSON body when present) and `success` (boolean) alongside the existing `status` (HTTP) and `ok` (computed).

### 2. `src/hooks/useConfiguredKycApi.tsx`
- Extend `KycApiResult` with `provider_name?`, `message_code?`, `status_code?`, `success?`, `endpoint_url?` and forward them from the edge response.

### 3. `src/hooks/useProviderVerify.tsx`
- After a call, fire a toast (sonner) showing the source + outcome:
  - Success: `toast.success("GST verified", { description: "via <provider_name> · message_code: success · 200" })`
  - Not configured (`!found`): `toast.error("GST provider not configured", { description: "Configure it in KYC & Validation API Settings" })`
  - Failure: `toast.error("GST verification failed", { description: "<message_code or message> · HTTP <status>" })`
- Keep the existing `state` shape for inline UI.

### 4. KYC tab OCR runners (`GstKycTab`, `PanKycTab`, `MsmeKycTab`, `BankKycTab`)
- Wrap each `runOcr` / `callProvider` invocation to also fire a sonner toast on completion using the same pattern as `useProviderVerify`. This covers the OCR-only paths that don't go through `useProviderVerify`.
- For Bank's penny-drop step inside `handleVerify`, also toast the BANK provider result.

### 5. `OcrUploadAndVerify` — remove Gemini fallback
- Drop the `useOcrExtraction` import + the `runOcr ?? extractFromFile(...)` branch.
- Make `runOcr` a **required** prop. If a caller ever forgets it, fail with a clear "OCR provider not configured" alert instead of silently calling Gemini.
- This guarantees no path in the registration flow can fall back to `google/gemini-2.5-flash`.

### 6. Admin visibility (small QoL)
- In `OcrUploadAndVerify`'s success alert, append `via <provider_name>` (passed back from the runner) so admins testing the flow can see at a glance which configured provider answered.

## Out of scope

- The legacy `ocr-extract` edge function and `useOcrExtraction` hook stay in the repo (other screens like `KycLiveTestPanel` may still use them). Only the **vendor registration KYC path** is hard-wired to configured providers.

## Files

- edit `supabase/functions/kyc-api-execute/index.ts`
- edit `src/hooks/useConfiguredKycApi.tsx`
- edit `src/hooks/useProviderVerify.tsx`
- edit `src/components/vendor/kyc/OcrUploadAndVerify.tsx`
- edit `src/components/vendor/kyc/GstKycTab.tsx`
- edit `src/components/vendor/kyc/PanKycTab.tsx`
- edit `src/components/vendor/kyc/MsmeKycTab.tsx`
- edit `src/components/vendor/kyc/BankKycTab.tsx`

## How you'll verify after approval

1. Trigger GST upload — toast shows `message_code: success` and `via GST_OCR (Surepass)`; Network tab shows POST to `kyc-api-execute`, **not** `ocr-extract`.
2. Disable the GST_OCR provider in KYC & Validation API Settings → re-upload → toast says "provider not configured" (no Gemini fallback).
3. Repeat for PAN / MSME / Bank.
