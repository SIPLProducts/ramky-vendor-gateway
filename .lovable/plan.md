# Fix: Buyer Company, SAP Sync, and PDF/Image OCR uploads

Three focused fixes. No other functionality changes.

## 1. Buyer Company should be readonly in Organization Profile

**File:** `src/components/vendor/steps/OrganizationStep.tsx` (lines ~248–278)

The Buyer Company `<Select>` currently lets the vendor change the value. Since it is derived from the buyer context (assigned during invite/registration), it must display only.

- Add `disabled` to the `<Select>` so the dropdown can't be reopened (keep the value rendered).
- Add a small helper text "Assigned by buyer — cannot be changed".
- Schema (`buyerCompanyId`) and the saved value remain untouched, so submit/validation still works.

## 2. "Sync to SAP" not hitting the Create-vendor API

**Files:** `src/pages/SAPSync.tsx`, `src/hooks/useVendors.tsx` (`useSapSync`), `supabase/functions/sync-vendor-to-sap/index.ts`

Symptoms from user: clicking **Sync to SAP** in `SapFieldsDialog` does nothing visible / edge function not invoked. The dialog confirm button calls `handleConfirmSync → sapSync.mutateAsync → supabase.functions.invoke('sync-vendor-to-sap', { body: { vendorId, overrides, sapPayload } })`.

Steps:

1. **Add a runtime guard + toast** in `handleConfirmSync` so failures (validation, build-payload throw, network) always surface a visible error instead of silently swallowing into the result dialog.
2. **Log + trace** in `useSapSync.mutationFn` before/after `buildSapPayload` so we can see in the console which step is failing (payload build vs. function invoke).
3. **Inspect `sync-vendor-to-sap` edge function logs** (via Lovable Cloud) for the failed call to identify whether the request is rejected (auth/JWT), payload validation, or upstream middleware reachability. Fix based on that diagnosis. Common causes to address:
   - `verify_jwt` mismatch or missing auth header
   - `buildSapPayload` throwing because a required override (e.g., `bukrs`, `akont`) is empty — surface those names in the toast
   - Middleware URL / shared-secret env not configured on the deployed function

4. Ensure the response from a non-success run still triggers `setShowSapResultDialog(true)` with the actual error message (already partially there — verify the error path).

## 3. PDF / PNG / JPEG uploads must be converted to image before OCR

**Files:** `src/lib/pdfToImage.ts`, `src/components/vendor/kyc/OcrUploadAndVerify.tsx`, `src/components/vendor/steps/DocumentVerificationStep.tsx`

User network capture shows `fileMimeType: "application/pdf"` reaching `kyc-api-execute`, which causes Surepass to return `no_gstin_detected` / `invalid_image`. Today the code *tries* to convert PDFs but silently falls back to the raw PDF when pdf.js's web-worker MIME fails — that is what is happening.

Changes:

1. **Default pdf.js to `disableWorker: true`** in `normalizeUploadToImage` so conversion works regardless of how the host serves `.mjs`. (We already retry without the worker on failure — make it the first attempt.)
2. **Remove the silent "send raw PDF" fallback** in:
   - `OcrUploadAndVerify.runPipeline` (lines ~94–101)
   - `DocumentVerificationStep.extractFromFile` (lines ~211–216)
   If conversion fails, show a clear error: *"Could not convert this PDF to an image. Please upload a JPG/PNG or a clearer PDF."* — and **do not** call the provider with `application/pdf`.
3. **Always normalize images too** (PNG/JPEG/WEBP/etc.) through `normalizeUploadToImage` so the provider always receives a clean JPEG (`image/jpeg`). Today images already pass through `imageFileToJpeg`, but the call sites short-circuit when the file is already an image — change them to always call `normalizeUploadToImage` regardless of input type.
4. Confirm `kyc-api-execute` payload after the fix shows `fileMimeType: "image/jpeg"` and a `.jpg` filename for every GST/PAN/MSME/Bank upload.

## Out of scope

International flow, classification UI, approval workflow, DB schema, validation rules, SAP master-data picker behavior, any other UI not listed above.
