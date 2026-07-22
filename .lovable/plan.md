## Goal

Improve the OCR failure experience in the Vendor Registration KYC step and clean up the response UI.

1. When **GST OCR** fails on upload, open a **manual entry popup** where the vendor types the GSTIN and it is validated via the configured **GSTIN Validation** provider (`GST`) using `{ id_number: "<GSTIN>" }`.
2. When **PAN OCR** fails on upload, open a **manual entry popup** where the vendor types the PAN and it is validated via the configured **PAN Comprehensive Validation** provider (`PAN`) using `{ id_number: "<PAN>" }`.
3. Remove the raw provider code badge (`GST_OCR`, `PAN_OCR`, `BANK_OCR`, `MSME_OCR`, `GST`, `PAN`, …) that currently appears next to the API response title.

Scope is limited to the vendor-facing KYC UI — no schema, no edge-function changes.

## Changes

### 1. New component: `src/components/vendor/kyc/ManualEntryFallbackDialog.tsx`

Reusable modal (built on `Dialog`) that:
- Accepts `open`, `onOpenChange`, `title` ("Enter GSTIN manually" / "Enter PAN manually"), `label`, `placeholder`, `maxLength`, `pattern` (client regex), and an async `onVerify(value)` handler.
- Renders one `Input` + a "Verify" button (loading, success, failure states) and shows the API message inline.
- On successful verification it invokes an `onSuccess(apiResult)` callback and closes.

### 2. `src/components/vendor/kyc/OcrUploadAndVerify.tsx`

- Add optional prop `onOcrFailed?: (reason: string) => void`.
- In `runPipeline`, when the OCR phase returns `!success` (or the verify phase fails because OCR could not be read), call `onOcrFailed(message)` after setting the failed state. The existing Retry button stays.

### 3. `src/components/vendor/kyc/GstKycTab.tsx`

- Add local state `manualFallbackOpen`.
- Pass `onOcrFailed={() => setManualFallbackOpen(true)}` to `OcrUploadAndVerify` (upload tab).
- Render `<ManualEntryFallbackDialog>` for GSTIN. On Verify:
  - Call `callProvider({ providerName: 'GST', input: { id_number: gstin } })`.
  - On `ok`, run the existing post-verification flow (set `gstin`, update `verifiedGstData`, trigger filing status check, name-match, `persistGstValidation`, `onStatusChange('passed')`, close dialog).
  - On failure, keep the dialog open and show the API `message` / `message_code`.
- Extract the existing "verified data → downstream side effects" block currently used by manual mode into a small helper so both the manual tab and the fallback dialog share it.

### 4. `src/components/vendor/kyc/PanKycTab.tsx`

- Add local state `manualFallbackOpen`.
- Pass `onOcrFailed={() => setManualFallbackOpen(true)}` to `OcrUploadAndVerify`.
- Render `<ManualEntryFallbackDialog>` for PAN (10 chars, regex `^[A-Z]{5}[0-9]{4}[A-Z]$`). On Verify:
  - Call `callProvider({ providerName: 'PAN', input: { id_number: pan } })` (PAN Comprehensive).
  - On success: set `props.pan`, parse `panStatus` / `aadhaarLinked` via the existing helpers, `updateResult(...)`, fire `onComprehensiveResult`, persist to `vendors` (same block already used by `runPanComprehensive`), set `onStatusChange('passed')`, close dialog.
  - Cross-name check against GST/MSME/Bank is still run when those names exist.
  - On failure keep the dialog open with the API message.
- Gate opening the dialog on `props.gstVerified` (same guard as OCR path); if GST isn't verified yet, show the existing warning instead.

### 5. `src/components/vendor/kyc/ApiResponseDetails.tsx`

- Remove the `<Badge variant="outline">{result.provider_name}</Badge>` line in the header so raw provider codes like `GST_OCR`, `PAN_OCR`, `BANK_OCR` no longer show up next to responses. Success/failure badge, status code, and message stay.

## Out of scope

- MSME and Bank OCR failure flows (user asked only for GST + PAN popups). Bank already has its own manual entry path.
- Any change to the configured KYC API providers, edge functions, or database.
