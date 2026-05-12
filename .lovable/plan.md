Plan:

1. Make upload conversion consistent and visible
- Update the client-side upload normalizer so every selected declaration file becomes a new image file, not only PDFs.
- Output declaration uploads as a single JPEG by default.
- Convert:
  - PDF: render all pages and stitch into one JPEG.
  - JPG/JPEG/PNG/WebP/BMP/GIF: load into canvas and re-encode as one JPEG.
  - DOCX: render document content to HTML, capture it, and save as one JPEG.
  - TXT/CSV and XLS/XLSX: render readable content/table preview, capture it, and save as one JPEG.
- For browser-unreadable legacy/binary formats, avoid the current “Unsupported file type” dead-end by showing a clear conversion failure message explaining the file content cannot be rendered client-side.

2. Apply conversion to the affected upload buttons
- Fix Non-GST Declaration and Non-MSME Declaration upload handlers to always store the converted JPEG file and show the converted filename.
- Update accepted file types and helper text so users can choose common document/image files, not only PDF/image.
- Keep the conversion fully client-side.

3. Correct the GST “No” path
- Keep the declaration template download and signed upload.
- Remove/hide the GST manual legal name/address fields from this path because the user specified GST-related fields below are not required.
- Once the signed declaration image is uploaded, automatically unlock/move to PAN.

4. Confirm the PAN, MSME, and Bank gating rules
- PAN: after upload/OCR, call the configured “PAN Comprehensive Validation” provider and pass only when response status is valid; show the requested success/failure message.
- MSME Yes: validate Udyam/MSME, compare MSME Enterprise Name with PAN Holder Name, pass at 40% or above, fail below 40% with the requested message.
- MSME No: require only the self-declaration upload, then move to Bank.
- Bank: after cancelled cheque upload/OCR, call configured Bank/Penny Drop validation and compare Account Holder Name against PAN only when GST=No/MSME=No, or against PAN + MSME when GST=No/MSME=Yes; fail below 40%, disable Continue, and allow re-upload/re-validation.

Technical details:
- Main files to update: `src/lib/pdfToImage.ts` and `src/components/vendor/steps/DocumentVerificationStep.tsx`.
- No backend changes are needed because this is frontend upload normalization and flow gating.