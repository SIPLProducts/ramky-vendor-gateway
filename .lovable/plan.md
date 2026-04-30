## Goal

Stop showing a hardcoded list of GST fields. Whatever the configured GST OCR API returns — show exactly that, dynamically.

Right now the GST tab uses a fixed `buildRows()` list (GSTIN, Legal Name, Business Name, PAN, Status, etc.) and a fixed `response_data_mapping` in the database. If Surepass returns `ocr_fields: []` and `message_code: no_gstin_detected`, the form shows blank rows + "HTTP 400" and the actual provider message is hidden.

## Changes

### 1. Edge function `kyc-api-execute`
- When the provider has **no `response_data_mapping` configured** (or it's empty), return the **entire upstream response payload** as `data` (flattened in a sensible way) so the UI can display all fields the provider actually returned.
- Always include the full upstream response under `raw` (already done) so the UI can fall back to it.
- Keep `message_code`, `status_code`, `success`, `message` surfacing exactly as the upstream API sent them.

### 2. Database — clear the hardcoded GST_OCR mapping
- Migration: set `response_data_mapping = '{}'` for `GST_OCR` (and optionally PAN/MSME/BANK OCR) so the executor falls back to "return the full provider response".
- Admins can still add a mapping later from the KYC API Settings screen if they want to rename fields.

### 3. GST tab UI — render whatever fields came back
- Replace the hardcoded `buildRows()` in `GstKycTab.tsx` with a generic renderer that:
  - Lists every key/value pair from the provider's response `data` (or from `raw` when `data` is empty).
  - Pretty-prints the field key (e.g. `gstin_status` → `GSTIN Status`).
  - Skips internal/empty values.
  - Shows the upstream `status_code`, `success`, `message_code` and `message` at the top of the result card so the vendor sees exactly what the API said.
- When the upstream response is an error (e.g. `no_gstin_detected`), show the provider's own `message` and `message_code` instead of "HTTP 400".

### 4. Apply the same dynamic display to PAN / MSME / Bank OCR tabs
- `PanKycTab`, `MsmeKycTab`, `BankKycTab`, and the OCR phase inside `DocumentVerificationStep` will all use the same generic "render raw API response" component so nothing is hardcoded.

### 5. Reusable component
- Add `src/components/vendor/kyc/ApiResponseDetails.tsx` that takes a `KycApiResult` and renders:
  - A header row with `provider_name`, `status_code`, `message_code`, `success`.
  - A key/value table of every non-empty field from `data` (or `raw.data` if `data` is empty).
  - The raw JSON in a collapsible `<details>` block for transparency.

## Files to change

- `supabase/functions/kyc-api-execute/index.ts`
- New migration to clear `response_data_mapping` for OCR providers
- `src/components/vendor/kyc/GstKycTab.tsx`
- `src/components/vendor/kyc/PanKycTab.tsx`
- `src/components/vendor/kyc/MsmeKycTab.tsx`
- `src/components/vendor/kyc/BankKycTab.tsx`
- `src/components/vendor/kyc/OcrUploadAndVerify.tsx` (use new generic renderer)
- New `src/components/vendor/kyc/ApiResponseDetails.tsx`

## Result

- Whatever the configured GST OCR API returns will be shown verbatim under the upload card.
- No field names are baked into the frontend.
- If the provider says `no_gstin_detected`, the UI shows that exact message and code — not "HTTP 400".
- If a different provider is configured later that returns different fields, those fields will automatically appear without code changes.