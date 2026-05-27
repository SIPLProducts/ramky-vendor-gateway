## Plan: Fix PDF upload OCR for GST / PAN / MSME / Bank

I will only change the PDF/image normalization path used before OCR, without changing validation rules or other registration behavior.

### 1. Replace “one huge stitched image” with OCR-safe conversion
- Update `src/lib/pdfToImage.ts` so PDF pages render more reliably.
- For single-page PDF: convert that page into a clean JPEG.
- For multi-page PDF: render all pages, but prevent one extremely tall/oversized image from being created.
- Add image-size limits and compression so the uploaded OCR image is readable and accepted by Surepass.

### 2. Improve PDF render reliability
- Keep `disableWorker: true` as default.
- Add safer PDF loading/render settings for browser-hosted PDFs.
- Use a controlled scale instead of producing huge canvas output.
- If a page is too large, downscale it before encoding.

### 3. Improve error message shown to vendor
- Replace the generic “upload clear PDF” message with a more accurate message when conversion fails.
- Make it clear whether the issue is conversion/rendering, file size, or unsupported/corrupt PDF.

### 4. Ensure OCR always receives image data
- Keep GST/PAN/MSME/Bank upload flows sending `image/jpeg` with `.jpg` filename to `kyc-api-execute`.
- Do not send `application/pdf` to the OCR provider.

### 5. Add diagnostics for verification
- Add safe console logging only for conversion output metadata: original file type, generated filename, MIME type, size, and dimensions.
- No sensitive document data will be logged.

### Expected result
- Clear one-page PDFs should convert and be sent to the OCR API as JPEG.
- Multi-page PDFs should not fail because of a huge stitched image.
- Surepass should receive `fileMimeType: "image/jpeg"` instead of `application/pdf`.