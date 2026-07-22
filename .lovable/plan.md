## Goal

Add a Manual Entry fallback popup for **GST** and **PAN** OCR failures inside the Document Verification step (mirroring the existing Bank cheque manual-entry flow), without changing any working behaviour.

## Where the change goes

The active document verification UI is `src/components/vendor/steps/DocumentVerificationStep.tsx` (the tabbed GST → PAN → MSME → Bank flow shown in the screenshot). Bank already has `openBankManualPopup(...)` triggered from OCR/verify failure. GST and PAN currently just render a "Failed" pill with a Retry — no manual entry option.

The reusable dialog `src/components/vendor/kyc/ManualEntryFallbackDialog.tsx` already exists and will be used as-is.

## Behaviour

### PAN tab
When the PAN pipeline fails (OCR unreadable, OCR returned invalid PAN, or PAN Comprehensive Validation returned an error such as "Invalid PAN"):
- Open a **Manual Entry** popup titled "Enter PAN manually".
- Input: 10-char PAN, pattern `^[A-Z]{5}[0-9]{4}[A-Z]$`, upper-cased, monospace.
- On Submit → call the existing `PAN` provider (PAN Comprehensive Validation) with `{ id_number: <pan>, pan: <pan> }`.
- On success:
  - Populate PAN doc state as if OCR had succeeded (status `verified`, `ocrData` filled from API response, `apiData` from the response).
  - Cross-check the returned holder name against GST/MSME/Bank names using the existing name-match logic — same rules as the OCR path.
  - Persist `pan_status` / `pan_aadhaar_linked` / `pan_comprehensive_verified_at` the same way the OCR path does.
  - Close the popup and let the workflow advance to MSME normally.
- On failure: show the API error message inside the popup (popup stays open).

### GST tab
When the GST pipeline fails (OCR could not detect a GSTIN, "No GSTIN detected", or GSTIN Validation API rejects):
- Open a **Manual Entry** popup titled "Enter GST manually".
- Input: 15-char GSTIN, pattern `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$`.
- On Submit → call the existing `GST` provider with `{ id_number: <gstin> }`.
- On success:
  - Populate GST doc state as if OCR had succeeded (`verified`, `ocrData` merged with the normalized registry payload, `apiData` from the response).
  - Downstream chain (PAN derived from GST etc.) continues normally.
- On failure: show the API error message inside the popup.

### Trigger points inside `runOcrAndVerify`
Add gst/pan branches next to the existing `cheque` branch in the failure paths already at lines ~1200 and ~1226:
1. OCR unreadable / confidence too low → open the corresponding manual popup, prefilled with any partial value OCR read.
2. Verification API returned not-ok → open the popup, prefilled with the OCR-read value so the vendor can correct 1-2 characters.

Manual retry (existing "Retry" button) stays intact. Popup can also be re-opened via an explicit "Enter manually" link added to the failed pill for GST/PAN, matching Bank's existing manual entry affordance.

## Cosmetic cleanup (part of the same request)

Remove the raw provider badge (`PAN_OCR`, `GST_OCR`, `BANK_OCR`, `MSME_OCR`) shown in the file pill next to the filename — the screenshot shows the green "PAN_OCR" chip. In `DocumentVerificationStep.tsx` around line 3347, drop the badge when `ocrModel` is one of the provider codes (keep it for actual model names like "Gemini 2.5 Pro"). The `friendlyModelName` map already covers real model names; we just filter out raw provider codes.

## Technical notes

- No changes to Bank flow.
- No changes to `useConfiguredKycApi`, backend, or provider configuration.
- No changes to the KYC-tab files (`GstKycTab.tsx`, `PanKycTab.tsx`) — they already have this behaviour but they're not the components rendered in the current registration UI.
- Reuses `ManualEntryFallbackDialog`, adds two local state slots (`gstManualPopup`, `panManualPopup`) and two submit handlers alongside `bankPopup`.
- On successful manual submission we synthesize the same `setDoc({ status: "verified", ... })` shape used by the OCR success path so all downstream logic (cross-tab locks, progress ring, "Continue" enablement, DMS payload) works identically.

## Files to modify

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — add gst/pan manual popup state, open triggers in the failure branches, submit handlers, dialog JSX, and provider-code badge filter.
