## Plan: Ensure GST/PAN/MSME/Bank uploads send JPEG/PNG to OCR, not PDF

### Problem to fix
The screenshot shows the request payload for `kyc-api-execute` still contains:

```text
fileMimeType: "application/pdf"
providerName: "GST_OCR"
```

That means the current screen is using the older `DocumentVerificationStep.tsx` upload flow, which calls the OCR provider directly with the original PDF. The PDF-to-JPEG conversion was added only to `OcrUploadAndVerify.tsx`, so it does not cover this specific registration page.

### Implementation steps
1. **Apply the existing PDF converter to the active registration upload flow**
   - Import `normalizeUploadToImage` into `src/components/vendor/steps/DocumentVerificationStep.tsx`.
   - In `runDocFlow`, before calling OCR, detect if the selected file is PDF.
   - If PDF, convert all pages into one stitched JPEG using the existing `src/lib/pdfToImage.ts` utility.
   - Send the converted JPEG file to `extractFromFile` / `callProvider` for OCR.
   - Keep the original uploaded PDF in the UI and draft data for audit/storage purposes.

2. **Make the UI status clear while conversion happens**
   - Add a new document status such as `preparing`.
   - Show a message like `Preparing document for OCR…` before `Reading certificate…`.
   - Include `preparing` as a busy state in the file pill so the user sees progress instead of an immediate failure.

3. **Add a defensive conversion inside the OCR helper**
   - Update `extractFromFile` so even if any direct caller sends a PDF, it normalizes the file to image before calling the configured OCR provider.
   - This prevents future regressions where another upload path bypasses `runDocFlow`.

4. **Improve conversion failure behavior**
   - If PDF conversion fails, show a clear user-facing error instead of silently sending the original PDF to OCR.
   - This is important because the requirement is that PDFs must not be sent as PDF to OCR.
   - The error will ask the user to retry with an image or a smaller/clearer PDF.

5. **Verify expected payload behavior**
   - After implementation, uploading a PDF GST certificate should result in the OCR request showing:

```text
providerName: "GST_OCR"
fileMimeType: "image/jpeg"
```

   - JPG/JPEG/PNG uploads should continue to pass through as image files unchanged.
   - The original filename and audit file shown in the UI can still remain `SIPL GST Certificate.pdf`; only the OCR payload changes to JPEG.

### Files to modify
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Possibly `src/lib/pdfToImage.ts` to expose a stricter conversion helper that reports whether conversion succeeded, instead of silently falling back to the original PDF.

### Out of scope
- No backend/database changes.
- No changes to the configured OCR provider templates.
- No change to original document storage/audit behavior.