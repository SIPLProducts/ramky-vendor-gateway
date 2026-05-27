## What's broken

**1. PDF upload (GST/PAN/MSME/Bank) — "Could not read this file"**

The recent rewrite of `src/lib/pdfToImage.ts` made client-side PDF→JPEG conversion **mandatory**. When pdf.js can't render a particular PDF (scanned-only pages, worker/CSP issues on the self-hosted `10.200.1.7` deployment, fonts blocked, etc.), `normalizeUploadToImage` now throws, and `OcrUploadAndVerify` shows "Could not read this file" — the OCR API is never called.

Previously the flow tolerated this: if conversion didn't work, the **original PDF was sent to the configured KYC provider** (Surepass actually accepts PDF on its OCR endpoints), and OCR ran server-side. That's why "previously it was working".

**2. Sync to SAP**

Both attached screenshots show the same GST upload error, so I don't have a fresh SAP-sync screenshot/log to look at. I'll need either a screenshot of the SAP Sync screen + browser console, or the message shown when clicking Sync. The plan below covers re-adding diagnostics so the actual failure surfaces in the UI/console instead of silently doing nothing.

## Fix plan

### A. `src/lib/pdfToImage.ts` — keep the good conversion, stop throwing

- Keep the new OCR-safe page rendering and master-canvas capping.
- Wrap the whole PDF branch in a single try/catch. On any failure (worker load, render of all pages, encode), **return the original file unchanged** with a console warning instead of throwing.
- For images, keep re-encoding to JPEG, but if canvas re-encode fails, return the original image file.
- DOCX / TXT still throw if conversion fails (provider can't read those raw).
- Net effect: when conversion works we send a clean JPEG; when it doesn't, the OCR provider gets the original PDF/image just like before.

### B. `src/components/vendor/kyc/OcrUploadAndVerify.tsx` — restore passthrough behavior

- Remove the hard `setPhase('failed')` on conversion error. Instead, log a warning and pass the original `file` straight into `runOcr`.
- Keep the "preparing" phase but treat it as best-effort, not a gate.
- Failure messaging stays for the actual OCR/verify step.

### C. `src/components/vendor/steps/DocumentVerificationStep.tsx`

- Same pattern: if `normalizeUploadToImage` throws, fall back to the original file and let the provider respond, instead of blocking the user with a generic "upload a clearer PDF" message.

### D. SAP Sync diagnostics (`src/pages/SAPSync.tsx` + `src/hooks/useVendors.tsx`)

- `handleConfirmSync` already toasts and logs. Add the same explicit logging inside `useSAPSync.mutateAsync` so we capture: the edge-function name being called, the request payload, and any thrown error / non-2xx body.
- Show the underlying edge-function error message in the result dialog instead of a generic "SAP sync failed".
- No hardcoding — the SAP endpoint, headers, and payload mapping continue to come from the admin-configured "Create vendor in SAP" record in **KYC & Validation / SAP API Settings**.

After this lands, please reproduce the SAP sync click once and share the toast message + browser console output so I can address that specific failure (likely either: no active SAP config row, missing required field in the payload mapping, or the SAP endpoint returning a non-JSON error). Nothing will be hardcoded.

### Out of scope

- Validation rules, registration flow, approval workflow, edge-function business logic, DB schema.
- The KYC provider list and SAP API config rows are left fully dynamic.

## Files touched

- `src/lib/pdfToImage.ts`
- `src/components/vendor/kyc/OcrUploadAndVerify.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/pages/SAPSync.tsx` (logging only)
- `src/hooks/useVendors.tsx` (logging only, in the SAP sync mutation)
