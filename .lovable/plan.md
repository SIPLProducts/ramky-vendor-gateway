# Convert Declaration Uploads to Single Image

When the user uploads a Non-GST or Non-MSME Self-Declaration document, normalize the file to a single PNG/JPG/JPEG before storing it in form state.

## Behavior

- **Image upload (PNG/JPG/JPEG)**: keep as-is (already in target format).
- **PDF upload (any number of pages)**: render every page client-side and stitch them vertically into one combined JPEG image. Replace the original `File` with the new image `File` (e.g. `original-name.jpg`) before calling `setGstDeclarationFile` / `setMsmeDeclarationFile`.
- **Other formats** (DOCX, etc.): reject with a toast — only PDF/PNG/JPG/JPEG are accepted for conversion.
- Show a small "Converting…" state on the dropzone while rendering, and a success toast like "Converted N pages to image" when done.

## Scope

Only the two declaration uploaders in `src/components/vendor/steps/DocumentVerificationStep.tsx`:
- GST Self-Declaration (`gstDeclarationFile`, ~line 1657)
- MSME Self-Declaration (`msmeDeclarationFile`, ~line 1852)

All other uploads (GST doc, PAN, MSME cert, Bank doc) are unchanged.

## Technical Notes

- Add a helper `src/lib/pdfToImage.ts` exporting `pdfToSingleImage(file: File, mime: 'image/jpeg'|'image/png' = 'image/jpeg'): Promise<File>`.
- Use `pdfjs-dist` (already a common dep; install if missing) with its worker loaded via `?url` import for Vite.
- For each PDF page: render to an offscreen canvas at scale ~1.5. Then create a master canvas with `width = max(pageWidths)` and `height = sum(pageHeights)`, draw each page stacked vertically on white background, and export via `canvas.toBlob` → wrap in `new File([blob], "<basename>.jpg", { type: 'image/jpeg' })`.
- Restrict `accept` on both dropzones to `.pdf,.jpg,.jpeg,.png` (already the case) and validate MIME on pick.
- Keep `accept` strings unchanged; conversion happens inside an `onPick` wrapper passed to `FileDropzone`.
